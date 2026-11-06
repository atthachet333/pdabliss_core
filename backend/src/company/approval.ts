import { z } from 'zod';
import type { DbClient, RequestMeta } from '../auth/audit.js';
import type { ApprovalPolicy, CompanyRole } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';
import { recordCompanyEvent, type ActorScope } from './audit.js';

/*
 * EP41 separation of duties — the ONE place that decides whether a
 * consequential decision may be made by this person (docs/EP41_APPROVAL_POLICY.md).
 *
 *   SELF_APPROVAL_ALLOWED  (pre-EP41) the permission alone decides
 *   INDEPENDENT_APPROVAL   the decider must be none of the document's originators;
 *                          the Company Owner may still decide through an explicit,
 *                          reasoned, audited override (SELF_APPROVAL_OVERRIDE)
 *
 * It never grants anything: every caller has already checked the decision's own
 * permission, branch and company. It is called inside the decision's transaction,
 * so the override audit entry and the decision commit (or roll back) together.
 */

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** `ownerOverride: { reason }` — the separate, clearly labelled override action. */
export const OwnerOverrideBody = z
  .object({
    reason: z
      .string()
      .trim()
      .min(10, 'give a reason of at least 10 characters')
      .max(500)
      .refine((v) => !CONTROL.test(v), 'invalid characters'),
  })
  .strict();
export type OwnerOverride = z.output<typeof OwnerOverrideBody>;

/** The body of a decision route: nothing, or an owner override. */
export const DecisionBody = z.object({ ownerOverride: OwnerOverrideBody.optional() }).strict();

export type OriginatorRole = 'requester' | 'creator' | 'submitter' | 'starter' | 'counter';

export interface DecisionFacts {
  /** The decision being made, e.g. 'approve', 'issue', 'confirm', 'post', 'accept'. */
  decision: string;
  entityType:
    | 'PurchaseRequest'
    | 'PurchaseOrder'
    | 'SalesOrder'
    | 'StockAdjustment'
    | 'CycleCount'
    | 'ProductionOrder'
    | 'ProductionMaterialIssue'
    | 'ProductionOutputReport'
    | 'ProductionGoodsReceipt';
  entityId: string;
  number: string;
  branchId: string;
  originators: { role: OriginatorRole; memberId: string | null | undefined }[];
}

export interface DecisionAccess {
  company: { id: string; approvalPolicy: ApprovalPolicy };
  actor: { memberId: string; userId: string; role: CompanyRole };
}

export async function requireIndependentDecision(
  tx: DbClient,
  meta: RequestMeta,
  access: DecisionAccess,
  facts: DecisionFacts,
  override: OwnerOverride | null | undefined,
  scope: ActorScope = 'customer',
) {
  const roles = [
    ...new Set(
      facts.originators.filter((o) => o.memberId === access.actor.memberId).map((o) => o.role),
    ),
  ];
  const independent = access.company.approvalPolicy === 'INDEPENDENT_APPROVAL';
  if (!independent || roles.length === 0) {
    // Only ever a real override in the audit trail.
    if (override) {
      throw new AppError(400, 'OVERRIDE_NOT_NEEDED', 'No owner override is needed here.');
    }
    return;
  }
  const isOwner = access.actor.role === 'COMPANY_OWNER';
  if (!override) {
    throw new AppError(
      409,
      'SELF_APPROVAL_NOT_ALLOWED',
      'Another person with approval rights must make this decision (independent approval).',
      { decision: facts.decision, roles, overridable: isOwner },
    );
  }
  if (!isOwner) {
    throw new AppError(
      403,
      'OVERRIDE_NOT_ALLOWED',
      'Only the company owner may override independent approval.',
    );
  }
  const branch = await tx.branch.findUnique({
    where: { id: facts.branchId },
    select: { code: true },
  });
  await recordCompanyEvent(tx, meta, {
    action: 'SELF_APPROVAL_OVERRIDE',
    actorId: access.actor.userId,
    actorScope: scope,
    companyId: access.company.id,
    entityType: facts.entityType,
    entityId: facts.entityId,
    details: {
      decision: facts.decision,
      number: facts.number,
      branch: branch?.code ?? facts.branchId,
      roles,
      reason: override.reason,
    },
  });
}
