import type { Db, Prisma } from '../db/client.js';
import type { Branch, CompanyMember } from '../generated/prisma/client.js';
import type { BranchAccessScope } from '../generated/prisma/enums.js';

/*
 * Branch access (EP26) — which branches a membership may WORK in.
 *
 *   ALL_BRANCHES       every active branch of the company (the default; every
 *                      membership that existed before EP26 has it)
 *   SELECTED_BRANCHES  only the branches listed in MemberBranchAccess
 *
 * The Company Owner is always ALL_BRANCHES (here, and by a database CHECK).
 * Branch access is operational scope only: administration authority (managing
 * branches, people, departments) comes from the role policy and never from it,
 * so a System Admin restricted to one branch still administers the company.
 *
 * Every branch-scoped check — the branch context, choosing a branch, and the
 * CORE Operations gate — reads this on the server, per request. A change of
 * access clears any session that now points at a branch it may not use.
 */

type Member = Pick<CompanyMember, 'id' | 'companyId' | 'role' | 'branchScope'>;

/** The scope that applies: the owner always works in every branch. */
export const effectiveScope = (
  m: Pick<CompanyMember, 'role' | 'branchScope'>,
): BranchAccessScope => (m.role === 'COMPANY_OWNER' ? 'ALL_BRANCHES' : m.branchScope);

/** Active branches of the member's company that the member may work in (code order, Head Office first). */
export async function allowedActiveBranches(
  db: Db | Prisma.TransactionClient,
  member: Member,
): Promise<Branch[]> {
  return db.branch.findMany({
    where: {
      companyId: member.companyId,
      status: 'ACTIVE',
      ...(effectiveScope(member) === 'ALL_BRANCHES'
        ? {}
        : { memberAccess: { some: { memberId: member.id } } }),
    },
    orderBy: { code: 'asc' },
  });
}

/** May this member work in this branch now? (same company, branch active, access granted) */
export async function canWorkInBranch(
  db: Db | Prisma.TransactionClient,
  member: Member,
  branchId: string,
): Promise<boolean> {
  const count = await db.branch.count({
    where: {
      id: branchId,
      companyId: member.companyId,
      status: 'ACTIVE',
      ...(effectiveScope(member) === 'ALL_BRANCHES'
        ? {}
        : { memberAccess: { some: { memberId: member.id } } }),
    },
  });
  return count > 0;
}

/**
 * Drops the branch context of every session of this member that points at a
 * branch the member may no longer work in (access changed, branch inactive).
 * Called in the same transaction as the change, so no stale context survives it.
 */
export async function clearStaleBranchSessions(
  tx: Prisma.TransactionClient,
  member: Member & { userId: string },
) {
  const allowed = await allowedActiveBranches(tx, member);
  return tx.session.updateMany({
    where: { userId: member.userId, branchId: { not: null, notIn: allowed.map((b) => b.id) } },
    data: { branchId: null, branchSelectedAt: null },
  });
}

/** Prisma filter: members who may work in `branchId` (owner, ALL_BRANCHES, or granted). */
export const worksInBranch = (branchId: string): Prisma.CompanyMemberWhereInput => ({
  OR: [
    { role: 'COMPANY_OWNER' },
    { branchScope: 'ALL_BRANCHES' },
    { branchAccess: { some: { branchId } } },
  ],
});
