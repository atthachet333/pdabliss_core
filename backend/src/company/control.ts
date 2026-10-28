import { createHash } from 'node:crypto';
import type { RequestMeta } from '../auth/audit.js';
import { toApiLocale, toDbLocale } from '../auth/locale.js';
import type { AuthContext } from '../auth/sessions.js';
import { DEPARTMENT_CODES, type DepartmentCode } from '../billing/catalog.js';
import type { Db, Prisma } from '../db/client.js';
import type { AuditLog, CompanyMember } from '../generated/prisma/client.js';
import type { AuthEventType } from '../generated/prisma/enums.js';
import { AppError, ValidationError } from '../lib/errors.js';
import { recordCompanyEvent, type CompanyAuditAction, type AuditEntityType } from './audit.js';
import { clearStaleBranchSessions, effectiveScope, worksInBranch } from './branch-access.js';
import {
  allowedDepartments,
  enabledDepartments,
  requireCompanyAccess,
  type CompanyAccess,
} from './context.js';
import { assertDepartments, readSnapshot } from './entitlements.js';
import {
  INVITATION_STATES,
  isThaiTaxId,
  LOGO_MAX_BYTES,
  postalCodeValid,
  type BranchCreateInput,
  type BranchUpdateInput,
  type LogoType,
  type InvitationListInput,
  type MemberBranchesInput,
  type MemberDepartmentsInput,
  type MemberListInput,
  type MemberUpdateInput,
  type ProfileInput,
  type SettingsInput,
} from './input.js';
import { ASSIGNABLE_ROLES, can, memberChangeProblem } from './policy.js';
import { DEPARTMENT_NAMES } from './service.js';
import { branchRef, branchView, companyFields, departmentView } from './views.js';

/*
 * Company Control Center (EP25) — the customer side of company administration.
 *
 * Every method starts from requireCompanyAccess(): the company is the caller's
 * own (from the session), the membership is ACTIVE, the company and its
 * subscription are ACTIVE (except the few reads the Account Portal already
 * used), and the role holds the capability. Ids in paths are looked up inside
 * that company, so another company's id is simply "not found".
 *
 * Every change is audited on the company's AuditLog. Nothing is hard-deleted:
 * branches and members are deactivated, departments soft-disabled.
 */

const MEMBER_PROBLEM_MESSAGES = {
  OWNER_PROTECTED: 'The Company Owner cannot be changed here.',
  SELF_CHANGE: 'You cannot change your own access.',
  PEER_ADMIN: 'Only the Company Owner can change a System Admin.',
} as const;

/** Security events of members that the company may see (type, person, time — no IP). */
const SECURITY_EVENT_TYPES: AuthEventType[] = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'OTP_FAILURE',
  'STEP_UP_SUCCESS',
  'LOGOUT',
  'LOGOUT_ALL',
  'SESSION_REVOKED',
  'PASSWORD_RESET_SUCCESS',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_REACTIVATED',
  'DEMO_AUTH_BYPASS',
];

/** A subscription period ending within this window is flagged on the overview. */
const PERIOD_ENDING_MS = 14 * 24 * 60 * 60_000;

const notFound = (what: 'Branch' | 'Member') =>
  new AppError(404, `${what.toUpperCase()}_NOT_FOUND`, `${what} not found.`);

/** EP26: the defaults of the people list (the EP25 call has no query). */
const MEMBER_LIST_DEFAULTS: MemberListInput = { page: 1, pageSize: 25 };

const byDepartmentOrder = (a: DepartmentCode, b: DepartmentCode) =>
  DEPARTMENT_CODES.indexOf(a) - DEPARTMENT_CODES.indexOf(b);

/** The next free 5-digit branch code after the highest one (00000 is the Head Office). */
export function nextBranchCode(codes: readonly string[]): string | null {
  const used = new Set(codes);
  const max = Math.max(0, ...codes.map(Number).filter(Number.isFinite));
  if (max < 99_999) return String(max + 1).padStart(5, '0');
  for (let i = 1; i <= 99_999; i++) {
    const code = String(i).padStart(5, '0');
    if (!used.has(code)) return code;
  }
  return null;
}

/** Leading bytes of the accepted logo types — the declared type must match the content. */
export function sniffImage(bytes: Buffer): LogoType | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')))
    return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    bytes.toString('latin1', 0, 4) === 'RIFF' &&
    bytes.toString('latin1', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  return null;
}

const isUniqueViolation = (e: unknown) =>
  typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002';

/** Holds the company row for the rest of the transaction (serializes limit checks). */
const lockCompany = (tx: Prisma.TransactionClient, companyId: string) =>
  tx.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${companyId} FOR UPDATE`;

export class CompanyControlService {
  constructor(private readonly db: Db) {}

  private event(
    db: Db | Prisma.TransactionClient,
    meta: RequestMeta,
    access: CompanyAccess,
    action: CompanyAuditAction,
    entityType: AuditEntityType,
    entityId: string,
    details?: Parameters<typeof recordCompanyEvent>[2]['details'],
  ) {
    return recordCompanyEvent(db, meta, {
      action,
      actorId: access.actor.userId,
      actorScope: 'customer',
      companyId: access.company.id,
      entityType,
      entityId,
      details,
    });
  }

  // ---------------------------------------------------------------- overview

  /**
   * The Company Control Center home: which company, what package, which
   * departments, how many branches and people, what is unfinished and what
   * needs attention — all from real rows. The price is not part of it.
   */
  async overview(ctx: AuthContext) {
    const access = await requireCompanyAccess(this.db, ctx);
    const companyId = access.company.id;
    const admin = can(access.member.role, 'members.manage');
    const now = new Date();
    const [branches, members, invitations, logo, departments, assignments, mine, withoutBranch] =
      await Promise.all([
        this.db.branch.findMany({ where: { companyId }, orderBy: { code: 'asc' } }),
        this.db.companyMember.groupBy({ by: ['status'], where: { companyId }, _count: true }),
        this.db.invitation.findMany({
          where: { companyId, status: 'PENDING' },
          select: { expiresAt: true },
        }),
        this.db.companyLogo.findUnique({
          where: { companyId },
          select: { sha256: true, contentType: true },
        }),
        enabledDepartments(this.db, companyId),
        this.db.membership.findMany({
          where: {
            department: { companyId, isActive: true },
            user: { companyMember: { companyId, status: 'ACTIVE' } },
          },
          select: { department: { select: { code: true } } },
        }),
        allowedDepartments(this.db, access),
        // EP26: active people restricted to branches of which none is active — they cannot work.
        this.db.companyMember.count({
          where: {
            companyId,
            status: 'ACTIVE',
            ownerSlot: null,
            branchScope: 'SELECTED_BRANCHES',
            branchAccess: { none: { branch: { status: 'ACTIVE' } } },
          },
        }),
      ]);
    const sub = access.subscription;
    const snapshot = sub ? readSnapshot(sub.entitlements, sub.plan) : null;
    const headOffice = branches.find((b) => b.type === 'HEAD_OFFICE') ?? null;
    const activeMembers = members.find((m) => m.status === 'ACTIVE')?._count ?? 0;
    const openInvitations = invitations.filter((i) => i.expiresAt > now).length;
    const expiredInvitations = invitations.length - openInvitations;
    const staffed = new Set(assignments.map((a) => a.department.code));
    const unassigned = departments.filter((d) => !staffed.has(d));
    const c = access.company;
    const missingProfile = (
      [
        ['legalName', c.legalName],
        ['taxId', c.taxId],
        ['phone', c.phone],
      ] as const
    )
      .filter(([, v]) => !v)
      .map(([k]) => k);

    const attention: Record<string, unknown>[] = [];
    if (admin) {
      if (missingProfile.length)
        attention.push({ code: 'PROFILE_INCOMPLETE', fields: missingProfile });
      if (activeMembers <= 1 && openInvitations === 0) attention.push({ code: 'ONLY_OWNER' });
      if (unassigned.length)
        attention.push({ code: 'DEPARTMENTS_UNASSIGNED', departments: unassigned });
      if (openInvitations) attention.push({ code: 'INVITATIONS_PENDING', count: openInvitations });
      if (expiredInvitations)
        attention.push({ code: 'INVITATIONS_EXPIRED', count: expiredInvitations });
      if (withoutBranch) attention.push({ code: 'MEMBERS_WITHOUT_BRANCH', count: withoutBranch });
      const inactiveBranches = branches.filter((b) => b.status === 'INACTIVE').length;
      if (inactiveBranches) attention.push({ code: 'BRANCHES_INACTIVE', count: inactiveBranches });
      if (
        sub?.currentPeriodEnd &&
        sub.currentPeriodEnd.getTime() - now.getTime() < PERIOD_ENDING_MS
      )
        attention.push({ code: 'PERIOD_ENDING', endsAt: sub.currentPeriodEnd.toISOString() });
    }
    const setup = [
      { id: 'profile', done: missingProfile.length === 0 },
      { id: 'logo', done: !!logo, optional: true },
      { id: 'team', done: activeMembers > 1 || openInvitations > 0 },
      { id: 'departments', done: unassigned.length === 0 },
    ];

    return {
      company: { ...companyFields(c), logo: logo ? { version: logo.sha256 } : null },
      me: {
        memberId: access.member.id,
        role: access.member.role,
        jobTitle: access.member.jobTitle,
        capabilities: access.capabilities,
        departments: mine,
      },
      headOffice: headOffice ? branchView(headOffice) : null,
      plan: sub
        ? {
            plan: sub.plan,
            status: sub.status,
            billingCycle: sub.billingCycle,
            maxDepartments: snapshot?.maxDepartments ?? 'CUSTOM',
            executiveAllowed: snapshot?.executiveAllowed ?? false,
          }
        : null,
      departments: { enabled: departments, unassigned },
      counts: {
        branches: {
          active: branches.filter((b) => b.status === 'ACTIVE').length,
          total: branches.length,
        },
        members: {
          active: activeMembers,
          deactivated: members.find((m) => m.status === 'DEACTIVATED')?._count ?? 0,
        },
        invitations: { open: openInvitations, expired: expiredInvitations },
      },
      setup: { steps: setup, complete: setup.every((s) => s.done || s.optional) },
      attention,
      access: { canEnterCore: access.canEnterCore },
    };
  }

  // ----------------------------------------------------------------- profile

  async updateProfile(ctx: AuthContext, input: ProfileInput, meta: RequestMeta) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'profile.edit' });
    const c = access.company;
    const headOffice = await this.db.branch.findFirst({
      where: { companyId: c.id, type: 'HEAD_OFFICE' },
    });

    // Tax ID format depends on the (possibly new) Head Office country.
    if (input.taxId) {
      const country = input.headOffice?.countryCode ?? headOffice?.countryCode ?? 'TH';
      const valid =
        country === 'TH' ? isThaiTaxId(input.taxId) : /^[A-Za-z0-9]{3,30}$/.test(input.taxId);
      if (!valid) {
        throw new ValidationError('Request validation failed', [
          { path: 'taxId', message: 'invalid tax ID' },
        ]);
      }
    }

    const next = {
      name: input.displayName,
      legalName: input.legalName,
      englishName: input.englishName,
      taxId: input.taxId,
      registrationNumber: input.registrationNumber,
      phone: input.phone,
      website: input.website,
      contactEmail: input.contactEmail,
      industry: input.industry,
    };
    const data: Prisma.CompanyUpdateInput = {};
    const fields: string[] = [];
    for (const [key, value] of Object.entries(next) as [keyof typeof next, unknown][]) {
      if (value === undefined || value === c[key]) continue;
      (data as Record<string, unknown>)[key] = value;
      fields.push(key === 'name' ? 'displayName' : key);
    }
    const address = input.headOffice;
    const addressChanged =
      !!address &&
      !!headOffice &&
      (address.addressLine1 !== headOffice.addressLine1 ||
        (address.addressLine2 ?? null) !== headOffice.addressLine2 ||
        (address.subdistrict ?? null) !== headOffice.subdistrict ||
        (address.district ?? null) !== headOffice.district ||
        address.province !== headOffice.province ||
        address.postalCode !== headOffice.postalCode ||
        address.countryCode !== headOffice.countryCode);
    if (addressChanged) fields.push('headOfficeAddress');

    if (fields.length) {
      await this.db.$transaction(async (tx) => {
        if (Object.keys(data).length) await tx.company.update({ where: { id: c.id }, data });
        if (addressChanged && address && headOffice) {
          await tx.branch.update({
            where: { id: headOffice.id },
            data: {
              addressLine1: address.addressLine1,
              addressLine2: address.addressLine2 ?? null,
              subdistrict: address.subdistrict ?? null,
              district: address.district ?? null,
              province: address.province,
              postalCode: address.postalCode,
              countryCode: address.countryCode,
            },
          });
        }
        await this.event(tx, meta, access, 'COMPANY_PROFILE_UPDATED', 'Company', c.id, { fields });
      });
    }
    return { ...(await this.overview(ctx)), changed: fields };
  }

  // -------------------------------------------------------------------- logo

  async logo(ctx: AuthContext) {
    const access = await requireCompanyAccess(this.db, ctx, { eligible: false });
    const logo = await this.db.companyLogo.findUnique({ where: { companyId: access.company.id } });
    if (!logo) throw new AppError(404, 'LOGO_NOT_FOUND', 'This company has no logo.');
    return logo;
  }

  async setLogo(
    ctx: AuthContext,
    input: { contentType: LogoType; data: string },
    meta: RequestMeta,
  ) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'profile.edit' });
    const bytes = Buffer.from(input.data, 'base64');
    if (bytes.length === 0 || bytes.length > LOGO_MAX_BYTES) {
      throw new AppError(413, 'LOGO_TOO_LARGE', 'The logo must be at most 256 KB.', {
        maxBytes: LOGO_MAX_BYTES,
      });
    }
    // The bytes decide, not the name or the declared type.
    if (sniffImage(bytes) !== input.contentType) {
      throw new AppError(415, 'LOGO_TYPE', 'Upload a PNG, JPEG or WebP image.');
    }
    const sha256 = createHash('sha256').update(bytes).digest('base64url');
    const companyId = access.company.id;
    await this.db.$transaction(async (tx) => {
      await tx.companyLogo.upsert({
        where: { companyId },
        create: {
          companyId,
          contentType: input.contentType,
          byteSize: bytes.length,
          sha256,
          data: bytes,
          uploadedById: access.actor.userId,
        },
        update: {
          contentType: input.contentType,
          byteSize: bytes.length,
          sha256,
          data: bytes,
          uploadedById: access.actor.userId,
        },
      });
      await this.event(tx, meta, access, 'COMPANY_LOGO_UPDATED', 'Company', companyId, {
        contentType: input.contentType,
        byteSize: bytes.length,
      });
    });
    return { logo: { version: sha256 } };
  }

  async removeLogo(ctx: AuthContext, meta: RequestMeta) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'profile.edit' });
    const companyId = access.company.id;
    await this.db.$transaction(async (tx) => {
      const { count } = await tx.companyLogo.deleteMany({ where: { companyId } });
      if (count) await this.event(tx, meta, access, 'COMPANY_LOGO_REMOVED', 'Company', companyId);
    });
    return { logo: null };
  }

  // ---------------------------------------------------------------- branches

  /**
   * Who may work where (EP26): for each branch, the active people who may work
   * in it (owner, all-branch access, or a grant) and the departments those
   * people are assigned to. Counts and codes only — no names on the list.
   */
  private async branchStats(companyId: string) {
    const [people, assignments] = await Promise.all([
      this.db.companyMember.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: {
          userId: true,
          role: true,
          branchScope: true,
          branchAccess: { select: { branchId: true } },
        },
      }),
      this.db.membership.findMany({
        where: { department: { companyId, isActive: true } },
        select: { userId: true, department: { select: { code: true } } },
      }),
    ]);
    const departmentsOf = new Map<string, DepartmentCode[]>();
    for (const a of assignments) {
      departmentsOf.set(a.userId, [...(departmentsOf.get(a.userId) ?? []), a.department.code]);
    }
    return (branchId: string) => {
      const here = people.filter(
        (p) =>
          effectiveScope(p) === 'ALL_BRANCHES' ||
          p.branchAccess.some((g) => g.branchId === branchId),
      );
      const departments = new Set(here.flatMap((p) => departmentsOf.get(p.userId) ?? []));
      return { people: here.length, departments: [...departments].sort(byDepartmentOrder) };
    };
  }

  /** Every branch of the caller's company (readable by any active member), with who works there (EP26). */
  async branches(ctx: AuthContext) {
    const access = await requireCompanyAccess(this.db, ctx, { eligible: false });
    const companyId = access.company.id;
    const [rows, stats] = await Promise.all([
      this.db.branch.findMany({ where: { companyId }, orderBy: { code: 'asc' } }),
      this.branchStats(companyId),
    ]);
    return {
      branches: rows.map((b) => ({ ...branchView(b), access: stats(b.id) })),
      suggestedCode: nextBranchCode(rows.map((b) => b.code)),
      canManage: access.canEnterCore && can(access.member.role, 'branches.manage'),
    };
  }

  /**
   * One branch (EP26): identity, status, address, contact and its access
   * configuration — how many people work there through all-branch access and
   * how many by a specific grant, the departments present and (for those who
   * may see people) who they are. Another company's branch is not found.
   */
  async branchDetail(ctx: AuthContext, id: string) {
    const access = await requireCompanyAccess(this.db, ctx);
    const companyId = access.company.id;
    const branch = await this.db.branch.findFirst({ where: { id, companyId } });
    if (!branch) throw notFound('Branch');
    const seePeople = can(access.member.role, 'members.view');
    const [stats, all, granted, people, enabled] = await Promise.all([
      this.branchStats(companyId),
      this.db.companyMember.count({
        where: {
          companyId,
          status: 'ACTIVE',
          OR: [{ role: 'COMPANY_OWNER' }, { branchScope: 'ALL_BRANCHES' }],
        },
      }),
      this.db.companyMember.count({
        where: {
          companyId,
          status: 'ACTIVE',
          role: { not: 'COMPANY_OWNER' },
          branchScope: 'SELECTED_BRANCHES',
          branchAccess: { some: { branchId: branch.id } },
        },
      }),
      seePeople
        ? this.db.companyMember.findMany({
            where: { companyId, status: 'ACTIVE', ...worksInBranch(branch.id) },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: 100,
            include: { user: { select: { fullName: true, email: true } } },
          })
        : Promise.resolve([]),
      enabledDepartments(this.db, companyId),
    ]);
    const departmentsOf = await this.departmentsByUser(
      companyId,
      people.map((p) => p.userId),
    );
    return {
      branch: branchView(branch),
      access: { ...stats(branch.id), allBranches: all, selected: granted },
      people: seePeople
        ? people.map((p) => ({
            id: p.id,
            fullName: p.user.fullName,
            email: p.user.email,
            role: p.role,
            scope: effectiveScope(p),
            departments: departmentsOf.get(p.userId) ?? [],
          }))
        : null,
      peopleTotal: seePeople ? all + granted : null,
      enabledDepartments: enabled,
      canManage: access.canEnterCore && can(access.member.role, 'branches.manage'),
      canManagePeople: can(access.member.role, 'members.manage'),
    };
  }

  /** Department assignments per user inside one company (code order). */
  private async departmentsByUser(companyId: string, userIds: string[]) {
    const out = new Map<string, ReturnType<typeof departmentView>[]>();
    if (!userIds.length) return out;
    const rows = await this.db.membership.findMany({
      where: { userId: { in: userIds }, department: { companyId } },
      include: { department: { select: { code: true, isActive: true } } },
    });
    for (const r of rows) out.set(r.userId, [...(out.get(r.userId) ?? []), departmentView(r)]);
    for (const list of out.values()) list.sort((a, b) => byDepartmentOrder(a.code, b.code));
    return out;
  }

  async createBranch(ctx: AuthContext, input: BranchCreateInput, meta: RequestMeta) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'branches.manage' });
    const companyId = access.company.id;
    try {
      const branch = await this.db.$transaction(async (tx) => {
        await lockCompany(tx, companyId);
        const codes = (
          await tx.branch.findMany({ where: { companyId }, select: { code: true } })
        ).map((b) => b.code);
        const code = input.code ?? nextBranchCode(codes);
        if (!code) throw new AppError(409, 'BRANCH_CODES_EXHAUSTED', 'No branch code is free.');
        if (codes.includes(code)) throw branchCodeTaken(code);
        const created = await tx.branch.create({
          data: {
            companyId,
            code,
            name: input.name,
            type: 'BRANCH',
            addressLine1: input.addressLine1,
            addressLine2: input.addressLine2 ?? null,
            subdistrict: input.subdistrict ?? null,
            district: input.district ?? null,
            province: input.province,
            postalCode: input.postalCode,
            countryCode: input.countryCode,
            phone: input.phone ?? null,
          },
        });
        await this.event(tx, meta, access, 'BRANCH_CREATED', 'Branch', created.id, {
          code,
          name: created.name,
        });
        return created;
      });
      return { branch: branchView(branch) };
    } catch (e) {
      // The database is the last word on uniqueness (concurrent creates).
      if (isUniqueViolation(e)) throw branchCodeTaken(input.code ?? null);
      throw e;
    }
  }

  async updateBranch(ctx: AuthContext, id: string, input: BranchUpdateInput, meta: RequestMeta) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'branches.manage' });
    const branch = await this.db.branch.findFirst({ where: { id, companyId: access.company.id } });
    if (!branch) throw notFound('Branch');
    const merged = {
      countryCode: input.countryCode ?? branch.countryCode,
      postalCode: input.postalCode ?? branch.postalCode,
    };
    if (!postalCodeValid(merged)) {
      throw new ValidationError('Request validation failed', [
        { path: 'postalCode', message: 'invalid postal code' },
      ]);
    }
    const data: Prisma.BranchUpdateInput = {};
    const fields: string[] = [];
    for (const [key, value] of Object.entries(input) as [keyof BranchUpdateInput, unknown][]) {
      if (value === undefined || value === branch[key]) continue;
      (data as Record<string, unknown>)[key] = value;
      fields.push(key);
    }
    if (!fields.length) return { branch: branchView(branch) };
    const updated = await this.db.$transaction(async (tx) => {
      const row = await tx.branch.update({ where: { id: branch.id }, data });
      await this.event(tx, meta, access, 'BRANCH_UPDATED', 'Branch', branch.id, {
        code: branch.code,
        fields,
      });
      return row;
    });
    return { branch: branchView(updated) };
  }

  /** Deactivate / reactivate. The Head Office is never deactivated (API + database CHECK). */
  async setBranchStatus(
    ctx: AuthContext,
    id: string,
    status: 'ACTIVE' | 'INACTIVE',
    meta: RequestMeta,
  ) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'branches.manage' });
    const branch = await this.db.branch.findFirst({ where: { id, companyId: access.company.id } });
    if (!branch) throw notFound('Branch');
    if (branch.type === 'HEAD_OFFICE') {
      throw new AppError(
        409,
        'HEAD_OFFICE_PROTECTED',
        'The Head Office (00000) cannot be deactivated or removed.',
      );
    }
    if (branch.status === 'CLOSED') {
      throw new AppError(409, 'BRANCH_CLOSED', 'A closed branch cannot be changed here.');
    }
    if (branch.status === status) return { branch: branchView(branch) };
    const updated = await this.db.$transaction(async (tx) => {
      const row = await tx.branch.update({
        where: { id: branch.id },
        data: { status, deactivatedAt: status === 'INACTIVE' ? new Date() : null },
      });
      // Nobody keeps working in a branch that is no longer active.
      if (status === 'INACTIVE') {
        await tx.session.updateMany({
          where: { branchId: branch.id },
          data: { branchId: null, branchSelectedAt: null },
        });
      }
      await this.event(tx, meta, access, 'BRANCH_STATUS_CHANGED', 'Branch', branch.id, {
        code: branch.code,
        from: branch.status,
        to: status,
      });
      return row;
    });
    return { branch: branchView(updated) };
  }

  // ----------------------------------------------------------------- members

  /**
   * People (EP25; EP26: server-side search, filters, pages, branch access).
   * Search covers name, email and job title; filters are role, membership
   * status, department and branch (who may work there). Never credentials,
   * sessions or sign-up lead data. `invitations` keeps the EP25 meaning (open
   * and expired-but-pending); the full lifecycle is GET /current/invitations.
   */
  async members(ctx: AuthContext, query: MemberListInput = MEMBER_LIST_DEFAULTS) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'members.view' });
    const companyId = access.company.id;
    const where: Prisma.CompanyMemberWhereInput = { companyId };
    const and: Prisma.CompanyMemberWhereInput[] = [];
    if (query.q) {
      const q = { contains: query.q, mode: 'insensitive' as const };
      and.push({ OR: [{ user: { fullName: q } }, { user: { email: q } }, { jobTitle: q }] });
    }
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    if (query.department) {
      and.push({
        user: { memberships: { some: { department: { companyId, code: query.department } } } },
      });
    }
    if (query.branch) and.push(worksInBranch(query.branch));
    if (and.length) where.AND = and;

    const skip = (query.page - 1) * query.pageSize;
    const [rows, total, summary, invitations, branches] = await Promise.all([
      this.db.companyMember.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take: query.pageSize,
        include: {
          user: {
            select: { email: true, fullName: true, phone: true, lastLoginAt: true, status: true },
          },
          branchAccess: { select: { branchId: true } },
        },
      }),
      this.db.companyMember.count({ where }),
      this.db.companyMember.groupBy({ by: ['status'], where: { companyId }, _count: true }),
      this.db.invitation.findMany({
        where: { companyId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { invitedBy: { select: { email: true, fullName: true } } },
      }),
      this.db.branch.findMany({ where: { companyId }, orderBy: { code: 'asc' } }),
    ]);
    const departmentsOf = await this.departmentsByUser(
      companyId,
      rows.map((m) => m.userId),
    );
    const manage = can(access.member.role, 'members.manage');
    const now = new Date();
    const byId = new Map(branches.map((b) => [b.id, b]));
    return {
      members: rows.map((m) =>
        this.memberView(m, access, manage, departmentsOf.get(m.userId) ?? [], byId),
      ),
      total,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: skip + rows.length < total,
      summary: {
        active: summary.find((s) => s.status === 'ACTIVE')?._count ?? 0,
        deactivated: summary.find((s) => s.status === 'DEACTIVATED')?._count ?? 0,
      },
      invitations: invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        locale: i.locale ? toApiLocale(i.locale) : null,
        state: i.expiresAt > now ? ('OPEN' as const) : ('EXPIRED' as const),
        invitedBy: { email: i.invitedBy.email, fullName: i.invitedBy.fullName },
        createdAt: i.createdAt.toISOString(),
        expiresAt: i.expiresAt.toISOString(),
      })),
      branches: branches.map(branchRef),
      assignableRoles: manage ? ASSIGNABLE_ROLES[access.member.role] : [],
      canManage: manage,
      enabledDepartments: await enabledDepartments(this.db, companyId),
      defaultLocale: toApiLocale(access.company.defaultLocale),
    };
  }

  /** One person as the people screens show them. */
  private memberView(
    m: CompanyMember & {
      user: {
        email: string;
        fullName: string | null;
        phone: string | null;
        lastLoginAt: Date | null;
        status: string;
      };
      branchAccess: { branchId: string }[];
    },
    access: CompanyAccess,
    manage: boolean,
    departments: ReturnType<typeof departmentView>[],
    branches: Map<string, Parameters<typeof branchRef>[0]>,
  ) {
    const scope = effectiveScope(m);
    return {
      id: m.id,
      fullName: m.user.fullName,
      email: m.user.email,
      phone: m.user.phone,
      jobTitle: m.jobTitle,
      role: m.role,
      status: m.status,
      accountStatus: m.user.status,
      joinedAt: m.createdAt.toISOString(),
      deactivatedAt: m.deactivatedAt?.toISOString() ?? null,
      lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
      departments,
      branchAccess: {
        scope,
        branches:
          scope === 'ALL_BRANCHES'
            ? []
            : m.branchAccess
                .map((g) => branches.get(g.branchId))
                .filter((b) => !!b)
                .map(branchRef)
                .sort((a, b) => a.code.localeCompare(b.code)),
      },
      isOwner: m.role === 'COMPANY_OWNER',
      isSelf: m.id === access.member.id,
      // What the caller may change on this person — decided here, shown by the UI.
      canManage: manage && memberChangeProblem(access.actor, m) === null,
    };
  }

  /**
   * One person (EP26): the member, what the caller may change and why not,
   * the choices for the editors (roles, enabled departments, branches) and
   * this person's administration history. Another company's member is not found.
   */
  async member(ctx: AuthContext, memberId: string) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'members.view' });
    const companyId = access.company.id;
    const m = await this.db.companyMember.findFirst({
      where: { id: memberId, companyId },
      include: {
        user: {
          select: { email: true, fullName: true, phone: true, lastLoginAt: true, status: true },
        },
        branchAccess: { select: { branchId: true } },
      },
    });
    if (!m) throw notFound('Member');
    const manage = can(access.member.role, 'members.manage');
    const [branches, departmentsOf, enabled, history] = await Promise.all([
      this.db.branch.findMany({ where: { companyId }, orderBy: { code: 'asc' } }),
      this.departmentsByUser(companyId, [m.userId]),
      enabledDepartments(this.db, companyId),
      this.db.auditLog.findMany({
        where: { companyId, entityType: 'CompanyMember', entityId: m.id },
        orderBy: { occurredAt: 'desc' },
        take: 20,
        include: { actor: { select: { email: true, fullName: true } } },
      }),
    ]);
    const byId = new Map(branches.map((b) => [b.id, b]));
    return {
      member: this.memberView(m, access, manage, departmentsOf.get(m.userId) ?? [], byId),
      /** Why the caller may not change this person (null when they may, or only read). */
      protection: manage ? memberChangeProblem(access.actor, m) : null,
      assignableRoles: manage ? ASSIGNABLE_ROLES[access.member.role] : [],
      enabledDepartments: enabled,
      branches: branches.map(branchRef),
      history: history.map((a) => auditItem(a)),
      canManage: manage,
    };
  }

  /** The target member, if the caller may change them. */
  private async manageable(ctx: AuthContext, memberId: string) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'members.manage' });
    const target = await this.db.companyMember.findFirst({
      where: { id: memberId, companyId: access.company.id },
    });
    if (!target) throw notFound('Member');
    const problem = memberChangeProblem(access.actor, target);
    if (problem) throw new AppError(403, problem, MEMBER_PROBLEM_MESSAGES[problem]);
    return { access, target };
  }

  async updateMember(
    ctx: AuthContext,
    memberId: string,
    input: MemberUpdateInput,
    meta: RequestMeta,
  ) {
    const { access, target } = await this.manageable(ctx, memberId);
    if (input.role && !ASSIGNABLE_ROLES[access.actor.role].includes(input.role)) {
      throw new AppError(403, 'ROLE_NOT_ASSIGNABLE', 'You cannot give this role.', {
        role: input.role,
      });
    }
    await this.db.$transaction(async (tx) => {
      if (input.role && input.role !== target.role) {
        // Never the owner row, even if something above were bypassed.
        const { count } = await tx.companyMember.updateMany({
          where: {
            id: target.id,
            companyId: access.company.id,
            role: target.role,
            ownerSlot: null,
          },
          data: { role: input.role },
        });
        if (count === 0)
          throw new AppError(409, 'MEMBER_CHANGED', 'This member changed meanwhile.');
        await this.event(tx, meta, access, 'MEMBER_ROLE_CHANGED', 'CompanyMember', target.id, {
          from: target.role,
          to: input.role,
        });
      }
      if (input.jobTitle !== undefined && input.jobTitle !== target.jobTitle) {
        await tx.companyMember.update({
          where: { id: target.id },
          data: { jobTitle: input.jobTitle },
        });
        await this.event(tx, meta, access, 'MEMBER_JOB_TITLE_CHANGED', 'CompanyMember', target.id);
      }
    });
    return this.members(ctx);
  }

  async setMemberStatus(
    ctx: AuthContext,
    memberId: string,
    status: 'ACTIVE' | 'DEACTIVATED',
    meta: RequestMeta,
  ) {
    const { access, target } = await this.manageable(ctx, memberId);
    if (target.status !== status) {
      await this.db.$transaction(async (tx) => {
        await tx.companyMember.update({
          where: { id: target.id },
          data: { status, deactivatedAt: status === 'DEACTIVATED' ? new Date() : null },
        });
        // A deactivated member keeps their account, but no branch context.
        if (status === 'DEACTIVATED') {
          await tx.session.updateMany({
            where: { userId: target.userId, branchId: { not: null } },
            data: { branchId: null, branchSelectedAt: null },
          });
        }
        await this.event(tx, meta, access, 'MEMBER_STATUS_CHANGED', 'CompanyMember', target.id, {
          from: target.status,
          to: status,
        });
      });
    }
    return this.members(ctx);
  }

  /**
   * Department assignments (EP25 foundation): one person, several departments,
   * one account. Only enabled departments can be assigned; assignments to a
   * soft-disabled department are kept untouched for when it returns.
   */
  async setMemberDepartments(
    ctx: AuthContext,
    memberId: string,
    input: MemberDepartmentsInput,
    meta: RequestMeta,
  ) {
    const { access, target } = await this.manageable(ctx, memberId);
    const companyId = access.company.id;
    const departments = await this.db.department.findMany({ where: { companyId, isActive: true } });
    const byCode = new Map(departments.map((d) => [d.code, d]));
    const missing = input.departments.filter((code) => !byCode.has(code));
    if (missing.length) {
      throw new AppError(422, 'DEPARTMENT_NOT_ENABLED', 'Assign only enabled departments.', {
        departments: missing,
      });
    }
    const primary = input.primary ?? (input.departments.length === 1 ? input.departments[0] : null);
    await this.db.$transaction(async (tx) => {
      const enabledIds = departments.map((d) => d.id);
      const wanted = input.departments.map((code) => byCode.get(code)!.id);
      await tx.membership.deleteMany({
        where: {
          userId: target.userId,
          departmentId: { in: enabledIds.filter((id) => !wanted.includes(id)) },
        },
      });
      for (const code of input.departments) {
        const departmentId = byCode.get(code)!.id;
        await tx.membership.upsert({
          where: { userId_departmentId: { userId: target.userId, departmentId } },
          create: { userId: target.userId, departmentId, isPrimary: code === primary },
          update: { isPrimary: code === primary },
        });
      }
      await this.event(tx, meta, access, 'MEMBER_DEPARTMENTS_CHANGED', 'CompanyMember', target.id, {
        departments: [...input.departments].sort(
          (a, b) => DEPARTMENT_CODES.indexOf(a) - DEPARTMENT_CODES.indexOf(b),
        ),
        primary: primary ?? null,
      });
    });
    return this.members(ctx);
  }

  /**
   * Branch access (EP26): every active branch, or a list of branches of this
   * company. The owner is never restricted (OWNER_PROTECTED here, a database
   * CHECK below); nobody changes their own access; a System Admin leaves other
   * System Admins to the owner. Any session of this person that points at a
   * branch they may no longer use loses that context in the same transaction.
   */
  async setMemberBranches(
    ctx: AuthContext,
    memberId: string,
    input: MemberBranchesInput,
    meta: RequestMeta,
  ) {
    const { access, target } = await this.manageable(ctx, memberId);
    const companyId = access.company.id;
    const ids = input.branchScope === 'SELECTED_BRANCHES' ? (input.branchIds ?? []) : [];
    const chosen = ids.length
      ? await this.db.branch.findMany({ where: { id: { in: ids }, companyId, status: 'ACTIVE' } })
      : [];
    if (chosen.length !== ids.length) {
      // Unknown, foreign or inactive ids are all "not available" — no existence leak.
      throw new AppError(
        422,
        'BRANCH_NOT_AVAILABLE',
        'Grant access only to active branches of this company.',
      );
    }
    const before = await this.db.memberBranchAccess.findMany({
      where: { memberId: target.id, companyId },
      include: { branch: { select: { code: true } } },
    });
    const beforeCodes = before.map((g) => g.branch.code).sort();
    const afterCodes = chosen.map((b) => b.code).sort();
    const unchanged =
      target.branchScope === input.branchScope &&
      (input.branchScope === 'ALL_BRANCHES' || beforeCodes.join() === afterCodes.join());
    if (!unchanged) {
      await this.db.$transaction(async (tx) => {
        // Only a non-owner row of this company, as it was read (no lost update).
        const { count } = await tx.companyMember.updateMany({
          where: { id: target.id, companyId, ownerSlot: null, role: { not: 'COMPANY_OWNER' } },
          data: { branchScope: input.branchScope },
        });
        if (count === 0)
          throw new AppError(409, 'MEMBER_CHANGED', 'This member changed meanwhile.');
        await tx.memberBranchAccess.deleteMany({
          where: { memberId: target.id, branchId: { notIn: chosen.map((b) => b.id) } },
        });
        if (chosen.length) {
          await tx.memberBranchAccess.createMany({
            data: chosen.map((b) => ({
              companyId,
              memberId: target.id,
              branchId: b.id,
              grantedById: access.actor.userId,
            })),
            skipDuplicates: true,
          });
        }
        await clearStaleBranchSessions(tx, { ...target, branchScope: input.branchScope });
        await this.event(
          tx,
          meta,
          access,
          'MEMBER_BRANCH_ACCESS_CHANGED',
          'CompanyMember',
          target.id,
          {
            fromScope: target.branchScope,
            fromBranches: target.branchScope === 'ALL_BRANCHES' ? [] : beforeCodes,
            toScope: input.branchScope,
            toBranches: afterCodes,
          },
        );
      });
    }
    return this.member(ctx, memberId);
  }

  // ------------------------------------------------------------- invitations

  /**
   * Invitations with their whole lifecycle (EP26): PENDING (open), EXPIRED
   * (pending, past its time), ACCEPTED, REVOKED — with the intended role,
   * departments and branch access, the inviter and the dates. Never a token.
   */
  async invitations(ctx: AuthContext, q: InvitationListInput) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'members.view' });
    const companyId = access.company.id;
    const now = new Date();
    const stateWhere: Record<(typeof INVITATION_STATES)[number], Prisma.InvitationWhereInput> = {
      PENDING: { status: 'PENDING', expiresAt: { gt: now } },
      EXPIRED: { status: 'PENDING', expiresAt: { lte: now } },
      ACCEPTED: { status: 'ACCEPTED' },
      REVOKED: { status: 'REVOKED' },
    };
    const where: Prisma.InvitationWhereInput = {
      companyId,
      ...(q.state === 'ALL' ? {} : stateWhere[q.state]),
    };
    const skip = (q.page - 1) * q.pageSize;
    const [rows, total, counts, branches] = await Promise.all([
      this.db.invitation.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: q.pageSize,
        include: {
          invitedBy: { select: { email: true, fullName: true } },
          acceptedBy: { select: { email: true, fullName: true } },
        },
      }),
      this.db.invitation.count({ where }),
      Promise.all(
        INVITATION_STATES.map((s) =>
          this.db.invitation.count({ where: { companyId, ...stateWhere[s] } }),
        ),
      ),
      this.db.branch.findMany({ where: { companyId } }),
    ]);
    const manage = can(access.member.role, 'members.manage');
    const byId = new Map(branches.map((b) => [b.id, b]));
    return {
      invitations: rows.map((i) => {
        const state =
          i.status === 'PENDING' ? (i.expiresAt > now ? 'PENDING' : 'EXPIRED') : i.status;
        return {
          id: i.id,
          email: i.email,
          role: i.role,
          locale: i.locale ? toApiLocale(i.locale) : null,
          state,
          departments: [...i.departments].sort(byDepartmentOrder),
          branchAccess: {
            scope: i.branchScope,
            // Ids that are no longer branches of this company are simply left out.
            branches: i.branchIds
              .map((id) => byId.get(id))
              .filter((b) => !!b)
              .map(branchRef)
              .sort((a, b) => a.code.localeCompare(b.code)),
          },
          invitedBy: { email: i.invitedBy.email, fullName: i.invitedBy.fullName },
          acceptedBy: i.acceptedBy
            ? { email: i.acceptedBy.email, fullName: i.acceptedBy.fullName }
            : null,
          resent: i.resentFromId !== null,
          createdAt: i.createdAt.toISOString(),
          expiresAt: i.expiresAt.toISOString(),
          acceptedAt: i.acceptedAt?.toISOString() ?? null,
          revokedAt: i.revokedAt?.toISOString() ?? null,
          // A System Admin leaves invitations for System Admins to the owner.
          canManage:
            manage &&
            state !== 'ACCEPTED' &&
            state !== 'REVOKED' &&
            ASSIGNABLE_ROLES[access.member.role].includes(i.role),
        };
      }),
      total,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: skip + rows.length < total,
      counts: Object.fromEntries(INVITATION_STATES.map((s, n) => [s, counts[n]!])),
      canManage: manage,
    };
  }

  // ------------------------------------------------------------- departments

  /**
   * Sets the enabled departments within the package (the server decides:
   * Starter ≤ 2 without Executive, Business ≤ 4, Professional 6, Enterprise as
   * agreed — at most the six). Disabling is soft and audited; assignments stay.
   */
  async setDepartments(ctx: AuthContext, codes: DepartmentCode[], meta: RequestMeta) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'departments.manage' });
    const sub = access.subscription;
    if (!sub) throw new AppError(409, 'NO_SUBSCRIPTION', 'This company has no subscription.');
    assertDepartments(readSnapshot(sub.entitlements, sub.plan), codes);
    if (codes.length === 0) {
      throw new AppError(422, 'DEPARTMENTS_REQUIRED', 'Keep at least one department enabled.');
    }
    const companyId = access.company.id;
    await this.db.$transaction(async (tx) => {
      await lockCompany(tx, companyId);
      const rows = await tx.department.findMany({ where: { companyId } });
      for (const code of DEPARTMENT_CODES) {
        const row = rows.find((d) => d.code === code);
        const want = codes.includes(code);
        if (want && !row?.isActive) {
          const dept = row
            ? await tx.department.update({ where: { id: row.id }, data: { isActive: true } })
            : await tx.department.create({
                data: { companyId, code, name: DEPARTMENT_NAMES[code] },
              });
          await this.event(tx, meta, access, 'DEPARTMENT_ENABLED', 'Department', dept.id, { code });
        } else if (!want && row?.isActive) {
          // Future operational modules register their dependency checks here
          // before a department may be disabled; EP25 has no operational data.
          await tx.department.update({ where: { id: row.id }, data: { isActive: false } });
          await this.event(tx, meta, access, 'DEPARTMENT_DISABLED', 'Department', row.id, { code });
        }
      }
    });
    return { enabled: await enabledDepartments(this.db, companyId) };
  }

  // ---------------------------------------------------------------- settings

  async settings(ctx: AuthContext) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'settings.manage' });
    return {
      timezone: access.company.timezone,
      defaultLocale: toApiLocale(access.company.defaultLocale),
    };
  }

  async updateSettings(ctx: AuthContext, input: SettingsInput, meta: RequestMeta) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'settings.manage' });
    const c = access.company;
    const data: Prisma.CompanyUpdateInput = {};
    const fields: string[] = [];
    if (input.timezone && input.timezone !== c.timezone) {
      data.timezone = input.timezone;
      fields.push('timezone');
    }
    const locale = input.defaultLocale ? toDbLocale(input.defaultLocale) : undefined;
    if (locale && locale !== c.defaultLocale) {
      data.defaultLocale = locale;
      fields.push('defaultLocale');
    }
    if (fields.length) {
      await this.db.$transaction(async (tx) => {
        await tx.company.update({ where: { id: c.id }, data });
        await this.event(tx, meta, access, 'COMPANY_SETTINGS_UPDATED', 'Company', c.id, { fields });
      });
    }
    return this.settings(ctx);
  }

  // ---------------------------------------------------------------- activity

  /**
   * The company's activity: administration events (AuditLog of this company)
   * and the security events of its people since they joined. Safe fields
   * only — no IP addresses, user agents, hashes or tokens. Platform operators
   * appear as "PDA BLISS", never by name.
   */
  async activity(ctx: AuthContext, q: { scope: 'all' | 'admin' | 'security'; limit: number }) {
    const access = await requireCompanyAccess(this.db, ctx, { capability: 'activity.view' });
    const companyId = access.company.id;
    const members = await this.db.companyMember.findMany({
      where: { companyId },
      select: { userId: true, createdAt: true },
    });
    const [admin, security] = await Promise.all([
      q.scope === 'security'
        ? Promise.resolve([])
        : this.db.auditLog.findMany({
            where: { companyId },
            orderBy: { occurredAt: 'desc' },
            take: q.limit,
            include: { actor: { select: { email: true, fullName: true } } },
          }),
      q.scope === 'admin' || members.length === 0
        ? Promise.resolve([])
        : this.db.authAuditEvent.findMany({
            where: {
              type: { in: SECURITY_EVENT_TYPES },
              OR: members.map((m) => ({ userId: m.userId, occurredAt: { gte: m.createdAt } })),
            },
            orderBy: { occurredAt: 'desc' },
            take: q.limit,
            include: { user: { select: { email: true, fullName: true } } },
          }),
    ]);
    const items = [
      ...admin.map((a) => auditItem(a)),
      ...security.map((e) => ({
        id: e.id,
        kind: 'security' as const,
        type: e.type,
        actor: e.user
          ? { kind: 'member' as const, email: e.user.email, fullName: e.user.fullName }
          : { kind: 'system' as const },
        entityType: 'User',
        details: {},
        occurredAt: e.occurredAt.toISOString(),
      })),
    ]
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, q.limit);
    return { items };
  }
}

const branchCodeTaken = (code: string | null) =>
  new AppError(409, 'BRANCH_CODE_TAKEN', 'This branch code is already used in this company.', {
    code,
  });

/**
 * One administration event as the company sees it: action, actor, entity and
 * small details. Platform operators appear as "PDA BLISS", never by name.
 */
function auditItem(a: AuditLog & { actor: { email: string; fullName: string | null } | null }) {
  const { actorScope, ...details } = (a.changes ?? {}) as Record<string, unknown>;
  const platform = actorScope === 'platform_owner' || actorScope === 'platform_admin';
  return {
    id: a.id,
    kind: 'admin' as const,
    type: a.action,
    actor: platform
      ? { kind: 'platform' as const }
      : a.actor
        ? { kind: 'member' as const, email: a.actor.email, fullName: a.actor.fullName }
        : { kind: 'system' as const },
    entityType: a.entityType,
    details,
    occurredAt: a.occurredAt.toISOString(),
  };
}
