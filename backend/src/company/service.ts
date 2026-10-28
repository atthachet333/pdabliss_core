import type { RequestMeta } from '../auth/audit.js';
import { forbidden } from '../auth/errors.js';
import type { AuthContext } from '../auth/sessions.js';
import {
  DEPARTMENT_CODES,
  isPlanCode,
  PLAN_CATALOG,
  type DepartmentCode,
  type PlanCode,
} from '../billing/catalog.js';
import type { Db } from '../db/client.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { AppLocale, CompanyRole } from '../generated/prisma/enums.js';
import { AppError, NotFoundError } from '../lib/errors.js';
import { recordCompanyEvent, type ActorScope } from './audit.js';
import { membershipInactive, noCompany } from './context.js';
import { can } from './policy.js';
import {
  branchView,
  companyFields,
  subscriptionView,
  type BranchView,
  type SubscriptionView,
} from './views.js';
import {
  assertDepartments,
  assertSubscriptionTransition,
  canEnterCore,
  entitlementView,
  readSnapshot,
  snapshotFor,
  type EntitlementView,
} from './entitlements.js';
import type { CreateCompanyInput, PlatformCompanyFilter } from './input.js';

/*
 * Company onboarding and the customer company context (EP24).
 *
 * Rules enforced here, never in the browser:
 * - One CORE workspace = one company; a customer account owns or belongs to at
 *   most one (CompanyMember.userId is unique), so there is no company switching
 *   and a retried "create" cannot make a second company.
 * - Every customer read derives the company from the caller's own membership —
 *   never from an id in the request. Ids in paths (branches, subscriptions)
 *   are looked up inside that company only, so another company's id is "not found".
 * - The plan comes from the account's package selection, validated against the
 *   catalog; prices and limits come from the catalog snapshot, not the client.
 * - Creating a company does not mean paying: the subscription starts PENDING and
 *   the company PENDING_SUBSCRIPTION. Only a platform operator can activate, and
 *   only through the development activation (not available in production).
 */

export const HEAD_OFFICE_CODE = '00000';

/** One audited Platform Inspection per operator and company per window (EP24.1). */
export const INSPECTION_AUDIT_WINDOW_MS = 15 * 60_000;

/** Departments in the canonical CORE order. */
const sortDepartments = (codes: DepartmentCode[]) =>
  DEPARTMENT_CODES.filter((code) => codes.includes(code));

export const DEPARTMENT_NAMES: Record<DepartmentCode, string> = {
  SALES: 'Sales',
  OPERATIONS: 'Operations',
  WAREHOUSE: 'Warehouse',
  PURCHASING: 'Purchasing',
  ACCOUNTING: 'Accounting & Finance',
  EXECUTIVE: 'Executive',
};

export const HEAD_OFFICE_NAMES: Record<AppLocale, string> = {
  th: 'สำนักงานใหญ่',
  en: 'Head Office',
  zh_CN: '总部',
};

export type OnboardingStage =
  | 'PLATFORM_OPERATOR'
  | 'NEEDS_PACKAGE'
  | 'NEEDS_COMPANY'
  | 'PENDING_ACTIVATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'CLOSED'
  /** EP25: the company deactivated this person's membership. */
  | 'MEMBERSHIP_INACTIVE';

export interface OnboardingView {
  stage: OnboardingStage;
  /** The package chosen for a company that does not exist yet. */
  selectedPlan: PlanCode | null;
  company: { id: string; displayName: string; isDemo: boolean; role: CompanyRole } | null;
  canEnterCore: boolean;
}

export type { BranchView, SubscriptionView };

export interface CompanyView {
  company: ReturnType<typeof companyFields>;
  role: CompanyRole;
  headOffice: BranchView | null;
  departments: DepartmentCode[];
  subscription: SubscriptionView | null;
  entitlements: EntitlementView | null;
  access: { canEnterCore: boolean };
  /**
   * EP25: whether this member may see what the company pays. Department roles
   * do not (warehouse users never see payment information).
   */
  priceVisible: boolean;
}

const companyExists = (companyId: string) =>
  new AppError(409, 'COMPANY_EXISTS', 'This account already has a CORE company.', { companyId });

/** The account's chosen package (stored as the lower-case public plan id). */
export function selectedPlan(planIntent: string | null): PlanCode | null {
  const code = planIntent?.toUpperCase();
  return isPlanCode(code) ? code : null;
}

/** Adds whole months in UTC, clamping to the last day of a shorter month. */
export function addMonthsUtc(from: Date, months: number): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      y,
      m,
      Math.min(from.getUTCDate(), lastDay),
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
}

const isUniqueViolation = (e: unknown) =>
  typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002';

export class CompanyService {
  constructor(
    private readonly db: Db,
    /** Development / test only: the manual activation endpoint exists. */
    readonly developmentActivation: boolean,
  ) {}

  private membership(userId: string) {
    return this.db.companyMember.findUnique({ where: { userId }, include: { company: true } });
  }

  private currentSubscription(companyId: string) {
    return this.db.subscription.findFirst({ where: { companyId, currentSlot: true } });
  }

  // ------------------------------------------------------------------ account

  async onboarding(ctx: AuthContext): Promise<OnboardingView> {
    if (ctx.user.platformRole) {
      return { stage: 'PLATFORM_OPERATOR', selectedPlan: null, company: null, canEnterCore: false };
    }
    const member = await this.membership(ctx.user.id);
    if (!member) {
      const plan = selectedPlan(ctx.user.planIntent);
      return {
        stage: plan ? 'NEEDS_COMPANY' : 'NEEDS_PACKAGE',
        selectedPlan: plan,
        company: null,
        canEnterCore: false,
      };
    }
    const company = member.company;
    const sub = await this.currentSubscription(company.id);
    const active = member.status === 'ACTIVE';
    const enter = active && canEnterCore(company, sub);
    return {
      stage: !active
        ? 'MEMBERSHIP_INACTIVE'
        : company.status === 'SUSPENDED'
          ? 'SUSPENDED'
          : company.status === 'CLOSED'
            ? 'CLOSED'
            : enter
              ? 'ACTIVE'
              : 'PENDING_ACTIVATION',
      selectedPlan: null,
      company: {
        id: company.id,
        displayName: company.name,
        isDemo: company.isDemo,
        role: member.role,
      },
      canEnterCore: enter,
    };
  }

  /** Choose (or change) the package before the company exists. */
  async selectPackage(ctx: AuthContext, plan: PlanCode, meta: RequestMeta) {
    if (ctx.user.platformRole) throw forbidden();
    const member = await this.membership(ctx.user.id);
    if (member) throw companyExists(member.companyId);
    await this.db.user.update({
      where: { id: ctx.user.id },
      data: { planIntent: plan.toLowerCase(), planSelectedAt: new Date() },
    });
    await recordCompanyEvent(this.db, meta, {
      action: 'PACKAGE_SELECTED',
      actorId: ctx.user.id,
      actorScope: 'customer',
      companyId: null,
      entityType: 'User',
      entityId: ctx.user.id,
      details: { plan },
    });
    return { selectedPlan: plan };
  }

  /**
   * Creates the company and everything it needs in one transaction: company,
   * COMPANY_OWNER membership, Head Office (00000), departments and a PENDING
   * subscription with the plan snapshot. Any failure rolls all of it back.
   */
  async createCompany(ctx: AuthContext, input: CreateCompanyInput, meta: RequestMeta) {
    // Platform operators run the platform; they never own a customer company.
    if (ctx.user.platformRole) throw forbidden();
    const existing = await this.membership(ctx.user.id);
    if (existing) throw companyExists(existing.companyId);

    const plan = selectedPlan(ctx.user.planIntent);
    if (!plan) {
      throw new AppError(409, 'PACKAGE_REQUIRED', 'Choose a package before creating the company.');
    }
    const snapshot = snapshotFor(plan);
    assertDepartments(snapshot, input.departments);
    const quotation = PLAN_CATALOG[plan].purchase === 'quotation';
    if (!quotation && input.departments.length === 0) {
      throw new AppError(422, 'DEPARTMENTS_REQUIRED', 'Choose at least one department.');
    }
    // Enterprise may leave departments to the agreed scope: onboarding stays open.
    const completed = input.departments.length > 0;
    const actor = { actorId: ctx.user.id, actorScope: 'customer' as const };

    try {
      const companyId = await this.db.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            name: input.displayName,
            legalName: input.legalName,
            taxId: input.taxId ?? null,
            registrationNumber: input.registrationNumber ?? null,
            status: 'PENDING_SUBSCRIPTION',
            onboardingStatus: completed ? 'COMPLETED' : 'IN_PROGRESS',
            createdById: ctx.user.id,
          },
        });
        const member = await tx.companyMember.create({
          data: {
            companyId: company.id,
            userId: ctx.user.id,
            role: 'COMPANY_OWNER',
            ownerSlot: true,
          },
        });
        const h = input.headOffice;
        const headOffice = await tx.branch.create({
          data: {
            companyId: company.id,
            code: HEAD_OFFICE_CODE,
            name: h.name ?? HEAD_OFFICE_NAMES[ctx.user.locale],
            type: 'HEAD_OFFICE',
            headOfficeSlot: true,
            addressLine1: h.addressLine1,
            addressLine2: h.addressLine2 ?? null,
            subdistrict: h.subdistrict ?? null,
            district: h.district ?? null,
            province: h.province,
            postalCode: h.postalCode,
            countryCode: h.countryCode,
            phone: h.phone ?? null,
          },
        });
        if (input.departments.length) {
          await tx.department.createMany({
            data: input.departments.map((code) => ({
              companyId: company.id,
              code,
              name: DEPARTMENT_NAMES[code],
            })),
          });
        }
        const subscription = await tx.subscription.create({
          data: {
            companyId: company.id,
            plan,
            status: 'PENDING',
            billingCycle: input.billingCycle,
            catalogVersion: snapshot.catalogVersion,
            monthlyPriceThb: snapshot.monthlyPriceThb,
            entitlements: { ...snapshot },
            currentSlot: true,
          },
        });

        const event = (
          action: Parameters<typeof recordCompanyEvent>[2]['action'],
          entityType: Parameters<typeof recordCompanyEvent>[2]['entityType'],
          entityId: string,
          details?: Parameters<typeof recordCompanyEvent>[2]['details'],
        ) =>
          recordCompanyEvent(tx, meta, {
            ...actor,
            companyId: company.id,
            action,
            entityType,
            entityId,
            details,
          });
        await event('COMPANY_CREATED', 'Company', company.id, { plan });
        await event('COMPANY_OWNER_ASSIGNED', 'CompanyMember', member.id, {
          role: 'COMPANY_OWNER',
        });
        await event('HEAD_OFFICE_CREATED', 'Branch', headOffice.id, { code: HEAD_OFFICE_CODE });
        await event('DEPARTMENTS_SELECTED', 'Company', company.id, {
          departments: input.departments,
        });
        await event('SUBSCRIPTION_CREATED', 'Subscription', subscription.id, {
          plan,
          status: 'PENDING',
          billingCycle: input.billingCycle,
          paid: false,
        });
        if (completed) await event('COMPANY_ONBOARDING_COMPLETED', 'Company', company.id);
        return company.id;
      });
      return this.viewFor(companyId, 'COMPANY_OWNER');
    } catch (e) {
      // A concurrent or retried request created the membership first.
      if (isUniqueViolation(e)) {
        const winner = await this.membership(ctx.user.id);
        if (winner) throw companyExists(winner.companyId);
      }
      throw e;
    }
  }

  // --------------------------------------------------------- company context

  /** An ACTIVE membership (EP25: a deactivated member keeps no company access). */
  private async requireMember(ctx: AuthContext) {
    const member = await this.membership(ctx.user.id);
    if (!member) throw noCompany();
    if (member.status !== 'ACTIVE') throw membershipInactive();
    return member;
  }

  private async viewFor(companyId: string, role: CompanyRole): Promise<CompanyView> {
    const priceVisible = can(role, 'company.subscription.view');
    const company = await this.db.company.findUniqueOrThrow({
      where: { id: companyId },
      include: {
        branches: { where: { type: 'HEAD_OFFICE' } },
        departments: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
        subscriptions: { where: { currentSlot: true } },
      },
    });
    const sub = company.subscriptions[0] ?? null;
    return {
      company: companyFields(company),
      role,
      headOffice: company.branches[0] ? branchView(company.branches[0]) : null,
      departments: company.departments.map((d) => d.code),
      subscription: sub ? subscriptionView(sub, priceVisible) : null,
      entitlements: sub ? entitlementView(readSnapshot(sub.entitlements, sub.plan)) : null,
      access: { canEnterCore: canEnterCore(company, sub) },
      priceVisible,
    };
  }

  async current(ctx: AuthContext): Promise<CompanyView> {
    const member = await this.requireMember(ctx);
    return this.viewFor(member.companyId, member.role);
  }

  async branches(ctx: AuthContext) {
    const { companyId } = await this.requireMember(ctx);
    const rows = await this.db.branch.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
    });
    return rows.map(branchView);
  }

  /** A branch of the caller's company — another company's id is simply not found. */
  async branch(ctx: AuthContext, id: string) {
    const { companyId } = await this.requireMember(ctx);
    const row = await this.db.branch.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundError('Branch not found.');
    return branchView(row);
  }

  /**
   * The subscription summary (EP25: Owner, System Admin and Executive only —
   * department roles never see what the company pays). Facts only: no
   * invoices, receipts or payment history exist yet, so none are shown.
   */
  async subscription(ctx: AuthContext, id?: string) {
    const { companyId, role } = await this.requireMember(ctx);
    if (!can(role, 'company.subscription.view')) throw forbidden();
    const row = id
      ? await this.db.subscription.findFirst({ where: { id, companyId } })
      : await this.currentSubscription(companyId);
    if (!row) throw new NotFoundError('Subscription not found.');
    const [enabled, branches] = await Promise.all([
      this.db.department.findMany({
        where: { companyId, isActive: true },
        select: { code: true },
      }),
      this.db.branch.groupBy({ by: ['status'], where: { companyId }, _count: true }),
    ]);
    const total = branches.reduce((n, b) => n + b._count, 0);
    return {
      subscription: subscriptionView(row),
      entitlements: entitlementView(readSnapshot(row.entitlements, row.plan)),
      departments: { enabled: sortDepartments(enabled.map((d) => d.code)) },
      branches: {
        active: branches.find((b) => b.status === 'ACTIVE')?._count ?? 0,
        total,
      },
      priceVisible: true,
    };
  }

  /**
   * Enabled departments and, per department, its state in the package and
   * how many people are assigned (EP25). Readable by every active member.
   */
  async departments(ctx: AuthContext) {
    const { companyId, role } = await this.requireMember(ctx);
    const [rows, sub, assignments] = await Promise.all([
      this.db.department.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' } }),
      this.currentSubscription(companyId),
      this.db.membership.groupBy({
        by: ['departmentId'],
        where: {
          department: { companyId },
          user: { companyMember: { companyId, status: 'ACTIVE' } },
        },
        _count: true,
      }),
    ]);
    const entitlements = sub ? entitlementView(readSnapshot(sub.entitlements, sub.plan)) : null;
    const enabled = sortDepartments(rows.filter((d) => d.isActive).map((d) => d.code));
    const counts = new Map(assignments.map((a) => [a.departmentId, a._count]));
    return {
      enabled,
      entitlements,
      departments: DEPARTMENT_CODES.map((code) => {
        const row = rows.find((d) => d.code === code);
        return {
          code,
          state: enabled.includes(code)
            ? ('ENABLED' as const)
            : code === 'EXECUTIVE' && entitlements && !entitlements.executiveAllowed
              ? ('NOT_IN_PACKAGE' as const)
              : ('AVAILABLE' as const),
          assigned: row ? (counts.get(row.id) ?? 0) : 0,
        };
      }),
      canManage: can(role, 'company.departments.manage'),
    };
  }

  // --------------------------------------------------------------- platform

  /**
   * The Platform Company Explorer (operators only — enforced by the route).
   * Newest first, one page at a time (cursor = last id), so the list scales
   * past a handful of companies. Search covers company names and the owner's
   * email / name; filters apply to the company and its current subscription.
   */
  async listForPlatform(filter: PlatformCompanyFilter) {
    const q = filter.q;
    const sub =
      filter.plan || filter.subscriptionStatus
        ? {
            subscriptions: {
              some: {
                currentSlot: true,
                ...(filter.plan && { plan: filter.plan }),
                ...(filter.subscriptionStatus && { status: filter.subscriptionStatus }),
              },
            },
          }
        : {};
    const where: Prisma.CompanyWhereInput = {
      ...(filter.status && { status: filter.status }),
      ...(filter.demo && { isDemo: filter.demo === 'only' }),
      ...(filter.onboardingStatus && { onboardingStatus: filter.onboardingStatus }),
      ...(filter.department && {
        departments: { some: { code: filter.department, isActive: true } },
      }),
      ...sub,
      ...(q && {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { legalName: { contains: q, mode: 'insensitive' } },
          {
            members: {
              some: {
                role: 'COMPANY_OWNER',
                user: {
                  OR: [
                    { emailNormalized: { contains: q.toLowerCase() } },
                    { fullName: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
            },
          },
        ],
      }),
    };
    const [rows, total] = await Promise.all([
      this.db.company.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: filter.limit + 1,
        ...(filter.cursor && { cursor: { id: filter.cursor }, skip: 1 }),
        include: {
          members: {
            where: { role: 'COMPANY_OWNER' },
            include: { user: { select: { email: true, fullName: true } } },
          },
          subscriptions: { where: { currentSlot: true } },
          departments: { where: { isActive: true }, select: { code: true } },
          _count: { select: { members: true, branches: true } },
        },
      }),
      this.db.company.count({ where }),
    ]);
    const page = rows.slice(0, filter.limit);
    const activity = page.length
      ? await this.db.auditLog.groupBy({
          by: ['companyId'],
          where: { companyId: { in: page.map((c) => c.id) } },
          _max: { occurredAt: true },
        })
      : [];
    const lastActivity = new Map(activity.map((a) => [a.companyId, a._max.occurredAt]));
    return {
      companies: page.map((c) => {
        const current = c.subscriptions[0] ?? null;
        const owner = c.members[0]?.user ?? null;
        const enabled = sortDepartments(c.departments.map((d) => d.code));
        return {
          id: c.id,
          name: c.name,
          legalName: c.legalName,
          isDemo: c.isDemo,
          status: c.status,
          onboardingStatus: c.onboardingStatus,
          owner: owner?.email ?? null,
          ownerName: owner?.fullName ?? null,
          plan: current?.plan ?? null,
          subscriptionStatus: current?.status ?? null,
          billingCycle: current?.billingCycle ?? null,
          maxDepartments: current
            ? entitlementView(readSnapshot(current.entitlements, current.plan)).maxDepartments
            : null,
          enabledDepartments: enabled,
          members: c._count.members,
          departments: enabled.length,
          branches: c._count.branches,
          createdAt: c.createdAt.toISOString(),
          lastActivityAt: lastActivity.get(c.id)?.toISOString() ?? null,
        };
      }),
      total,
      nextCursor: rows.length > filter.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  /**
   * Platform Inspection of one company: read-only, at platform level — the
   * operator never becomes the customer. A visit is audited
   * (PLATFORM_COMPANY_INSPECTED, at most once per operator and company per
   * INSPECTION_AUDIT_WINDOW_MS) when `inspector` is given.
   */
  async detailForPlatform(id: string, inspector?: { ctx: AuthContext; meta: RequestMeta }) {
    const c = await this.db.company.findUnique({
      where: { id },
      include: {
        branches: { orderBy: { code: 'asc' } },
        departments: { orderBy: { createdAt: 'asc' } },
        subscriptions: { orderBy: { createdAt: 'desc' } },
        members: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
                jobFunction: true,
                status: true,
                lastLoginAt: true,
                signupContext: {
                  select: {
                    companyName: true,
                    industry: true,
                    teamSize: true,
                    preferredContact: true,
                    lineId: true,
                    interests: true,
                    note: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!c) throw new NotFoundError('Company not found.');
    if (inspector) await this.recordInspection(inspector.ctx, inspector.meta, c.id);

    const current = c.subscriptions.find((s) => s.currentSlot) ?? null;
    const entitlements = current
      ? entitlementView(readSnapshot(current.entitlements, current.plan))
      : null;
    const enabled = new Set(c.departments.filter((d) => d.isActive).map((d) => d.code));
    const owner = c.members.find((m) => m.role === 'COMPANY_OWNER')?.user ?? null;
    const userIds = c.members.map((m) => m.user.id);
    const [activity, security] = await Promise.all([
      this.db.auditLog.findMany({
        where: { companyId: c.id },
        orderBy: { occurredAt: 'desc' },
        take: 50,
        include: { actor: { select: { email: true, fullName: true } } },
      }),
      userIds.length
        ? this.db.authAuditEvent.findMany({
            where: { userId: { in: userIds } },
            orderBy: { occurredAt: 'desc' },
            take: 30,
            include: { user: { select: { email: true } } },
          })
        : Promise.resolve([]),
    ]);

    return {
      company: companyFields(c),
      owner: owner
        ? {
            email: owner.email,
            fullName: owner.fullName,
            phone: owner.phone,
            // What the owner said at sign-up — lead context, not company data.
            signup: owner.signupContext,
          }
        : null,
      branches: c.branches.map(branchView),
      departments: sortDepartments([...enabled]),
      departmentStates: DEPARTMENT_CODES.map((code) => ({
        code,
        state: enabled.has(code)
          ? ('ENABLED' as const)
          : code === 'EXECUTIVE' && entitlements && !entitlements.executiveAllowed
            ? ('NOT_IN_PACKAGE' as const)
            : ('NOT_ENABLED' as const),
      })),
      subscriptions: c.subscriptions.map((s) => subscriptionView(s)),
      entitlements,
      members: c.members.map((m) => ({
        email: m.user.email,
        fullName: m.user.fullName,
        jobFunction: m.user.jobFunction,
        status: m.user.status,
        role: m.role,
        // EP25: the membership itself (soft-deactivated by the company) and its job title.
        membershipStatus: m.status,
        jobTitle: m.jobTitle,
        joinedAt: m.createdAt.toISOString(),
        lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
      })),
      // Business events of this company (EP24 AuditLog): small, non-secret details only.
      activity: activity.map((a) => {
        const { actorScope, ...details } = (a.changes ?? {}) as Record<string, unknown>;
        return {
          id: a.id,
          action: a.action,
          actorScope: typeof actorScope === 'string' ? actorScope : null,
          actor: a.actor ? { email: a.actor.email, fullName: a.actor.fullName } : null,
          entityType: a.entityType,
          details,
          occurredAt: a.occurredAt.toISOString(),
        };
      }),
      // Sign-in / security events of this company's members — type, person and time only.
      security: security.map((e) => ({
        id: e.id,
        type: e.type,
        email: e.user?.email ?? null,
        occurredAt: e.occurredAt.toISOString(),
      })),
      access: { canEnterCore: canEnterCore(c, current) },
      developmentActivation: this.developmentActivation,
    };
  }

  private async recordInspection(ctx: AuthContext, meta: RequestMeta, companyId: string) {
    const recent = await this.db.auditLog.count({
      where: {
        companyId,
        actorId: ctx.user.id,
        action: 'PLATFORM_COMPANY_INSPECTED',
        occurredAt: { gte: new Date(Date.now() - INSPECTION_AUDIT_WINDOW_MS) },
      },
    });
    if (recent) return;
    await recordCompanyEvent(this.db, meta, {
      action: 'PLATFORM_COMPANY_INSPECTED',
      actorId: ctx.user.id,
      actorScope:
        ctx.user.platformRole?.role === 'PLATFORM_OWNER' ? 'platform_owner' : 'platform_admin',
      companyId,
      entityType: 'Company',
      entityId: companyId,
      details: { mode: 'read_only' },
    });
  }

  /**
   * DEVELOPMENT / TEST ONLY — never registered in production. Marks a PENDING
   * subscription ACTIVE without any payment so the onboarding → Control Center
   * path can be exercised. Audited as a manual development activation, `paid: false`.
   */
  async activateForDevelopment(ctx: AuthContext, companyId: string, meta: RequestMeta) {
    if (!this.developmentActivation) throw new NotFoundError();
    const role = ctx.user.platformRole?.role;
    if (!role) throw forbidden();
    const company = await this.db.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundError('Company not found.');
    const sub = await this.currentSubscription(companyId);
    if (!sub) throw new NotFoundError('This company has no subscription.');
    assertSubscriptionTransition(sub.status, 'ACTIVE');
    if (company.onboardingStatus !== 'COMPLETED') {
      throw new AppError(409, 'ONBOARDING_INCOMPLETE', 'Finish onboarding (departments) first.');
    }
    if (company.status !== 'PENDING_SUBSCRIPTION') {
      throw new AppError(
        409,
        'INVALID_TRANSITION',
        `A ${company.status} company cannot be activated here.`,
      );
    }
    const now = new Date();
    const actorScope: ActorScope = role === 'PLATFORM_OWNER' ? 'platform_owner' : 'platform_admin';
    await this.db.$transaction(async (tx) => {
      const { count } = await tx.subscription.updateMany({
        where: { id: sub.id, status: 'PENDING' },
        data: {
          status: 'ACTIVE',
          startsAt: now,
          activatedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: addMonthsUtc(now, sub.billingCycle === 'ANNUAL' ? 12 : 1),
        },
      });
      if (count === 0)
        throw new AppError(409, 'INVALID_TRANSITION', 'The subscription changed meanwhile.');
      await tx.company.update({
        where: { id: companyId },
        data: { status: 'ACTIVE', activatedAt: now },
      });
      const base = { actorId: ctx.user.id, actorScope, companyId };
      await recordCompanyEvent(tx, meta, {
        ...base,
        action: 'SUBSCRIPTION_STATUS_CHANGED',
        entityType: 'Subscription',
        entityId: sub.id,
        details: { from: 'PENDING', to: 'ACTIVE', mode: 'development_manual', paid: false },
      });
      await recordCompanyEvent(tx, meta, {
        ...base,
        action: 'COMPANY_STATUS_CHANGED',
        entityType: 'Company',
        entityId: companyId,
        details: { from: 'PENDING_SUBSCRIPTION', to: 'ACTIVE', mode: 'development_manual' },
      });
    });
    return this.detailForPlatform(companyId);
  }
}
