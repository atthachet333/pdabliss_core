import type { RequestMeta } from '../auth/audit.js';
import { forbidden } from '../auth/errors.js';
import type { AuthContext } from '../auth/sessions.js';
import {
  isPlanCode,
  PLAN_CATALOG,
  type DepartmentCode,
  type PlanCode,
} from '../billing/catalog.js';
import type { Db } from '../db/client.js';
import type { Branch, Company, Subscription } from '../generated/prisma/client.js';
import type { AppLocale, CompanyRole } from '../generated/prisma/enums.js';
import { AppError, NotFoundError } from '../lib/errors.js';
import { recordCompanyEvent, type ActorScope } from './audit.js';
import {
  assertDepartments,
  assertSubscriptionTransition,
  canEnterCore,
  entitlementView,
  readSnapshot,
  snapshotFor,
  type EntitlementView,
} from './entitlements.js';
import type { CreateCompanyInput } from './input.js';

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

const DEPARTMENT_NAMES: Record<DepartmentCode, string> = {
  SALES: 'Sales',
  OPERATIONS: 'Operations',
  WAREHOUSE: 'Warehouse',
  PURCHASING: 'Purchasing',
  ACCOUNTING: 'Accounting & Finance',
  EXECUTIVE: 'Executive',
};

const HEAD_OFFICE_NAMES: Record<AppLocale, string> = {
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
  | 'CLOSED';

export interface OnboardingView {
  stage: OnboardingStage;
  /** The package chosen for a company that does not exist yet. */
  selectedPlan: PlanCode | null;
  company: { id: string; displayName: string; isDemo: boolean; role: CompanyRole } | null;
  canEnterCore: boolean;
}

export interface BranchView {
  id: string;
  code: string;
  name: string;
  type: 'HEAD_OFFICE' | 'BRANCH';
  status: string;
  address: {
    line1: string;
    line2: string | null;
    subdistrict: string | null;
    district: string | null;
    province: string;
    postalCode: string;
    countryCode: string;
  };
  phone: string | null;
}

export interface SubscriptionView {
  id: string;
  plan: PlanCode;
  status: string;
  billingCycle: string;
  monthlyPriceThb: number | null;
  catalogVersion: number;
  createdAt: string;
  activatedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface CompanyView {
  company: {
    id: string;
    displayName: string;
    legalName: string | null;
    taxId: string | null;
    registrationNumber: string | null;
    status: string;
    onboardingStatus: string;
    isDemo: boolean;
    createdAt: string;
    activatedAt: string | null;
  };
  role: CompanyRole;
  headOffice: BranchView | null;
  departments: DepartmentCode[];
  subscription: SubscriptionView | null;
  entitlements: EntitlementView | null;
  access: { canEnterCore: boolean };
}

const branchView = (b: Branch): BranchView => ({
  id: b.id,
  code: b.code,
  name: b.name,
  type: b.type,
  status: b.status,
  address: {
    line1: b.addressLine1,
    line2: b.addressLine2,
    subdistrict: b.subdistrict,
    district: b.district,
    province: b.province,
    postalCode: b.postalCode,
    countryCode: b.countryCode,
  },
  phone: b.phone,
});

const subscriptionView = (s: Subscription): SubscriptionView => ({
  id: s.id,
  plan: s.plan,
  status: s.status,
  billingCycle: s.billingCycle,
  monthlyPriceThb: s.monthlyPriceThb,
  catalogVersion: s.catalogVersion,
  createdAt: s.createdAt.toISOString(),
  activatedAt: s.activatedAt?.toISOString() ?? null,
  currentPeriodStart: s.currentPeriodStart?.toISOString() ?? null,
  currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
  cancelAtPeriodEnd: s.cancelAtPeriodEnd,
});

const companyExists = (companyId: string) =>
  new AppError(409, 'COMPANY_EXISTS', 'This account already has a CORE company.', { companyId });

const noCompany = () => new NotFoundError('This account has no CORE company yet.');

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
    const enter = canEnterCore(company, sub);
    return {
      stage:
        company.status === 'SUSPENDED'
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

  private async requireMember(ctx: AuthContext) {
    const member = await this.membership(ctx.user.id);
    if (!member) throw noCompany();
    return member;
  }

  private async viewFor(companyId: string, role: CompanyRole): Promise<CompanyView> {
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
      subscription: sub ? subscriptionView(sub) : null,
      entitlements: sub ? entitlementView(readSnapshot(sub.entitlements, sub.plan)) : null,
      access: { canEnterCore: canEnterCore(company, sub) },
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

  async subscription(ctx: AuthContext, id?: string) {
    const { companyId } = await this.requireMember(ctx);
    const row = id
      ? await this.db.subscription.findFirst({ where: { id, companyId } })
      : await this.currentSubscription(companyId);
    if (!row) throw new NotFoundError('Subscription not found.');
    return {
      subscription: subscriptionView(row),
      entitlements: entitlementView(readSnapshot(row.entitlements, row.plan)),
    };
  }

  async departments(ctx: AuthContext) {
    const { companyId } = await this.requireMember(ctx);
    const [rows, sub] = await Promise.all([
      this.db.department.findMany({
        where: { companyId, isActive: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.currentSubscription(companyId),
    ]);
    return {
      enabled: rows.map((d) => d.code),
      entitlements: sub ? entitlementView(readSnapshot(sub.entitlements, sub.plan)) : null,
    };
  }

  // --------------------------------------------------------------- platform

  /** Every customer company (platform operators only — enforced by the route). */
  async listForPlatform() {
    const rows = await this.db.company.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        members: {
          where: { role: 'COMPANY_OWNER' },
          include: { user: { select: { email: true } } },
        },
        subscriptions: { where: { currentSlot: true } },
        _count: { select: { members: true, departments: true, branches: true } },
      },
    });
    return rows.map((c) => {
      const sub = c.subscriptions[0] ?? null;
      return {
        id: c.id,
        name: c.name,
        legalName: c.legalName,
        isDemo: c.isDemo,
        status: c.status,
        onboardingStatus: c.onboardingStatus,
        owner: c.members[0]?.user.email ?? null,
        plan: sub?.plan ?? null,
        subscriptionStatus: sub?.status ?? null,
        members: c._count.members,
        departments: c._count.departments,
        branches: c._count.branches,
        createdAt: c.createdAt.toISOString(),
      };
    });
  }

  async detailForPlatform(id: string) {
    const c = await this.db.company.findUnique({
      where: { id },
      include: {
        branches: { orderBy: { code: 'asc' } },
        departments: { orderBy: { createdAt: 'asc' } },
        subscriptions: { orderBy: { createdAt: 'desc' } },
        members: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { email: true, status: true } } },
        },
      },
    });
    if (!c) throw new NotFoundError('Company not found.');
    const current = c.subscriptions.find((s) => s.currentSlot) ?? null;
    return {
      company: companyFields(c),
      branches: c.branches.map(branchView),
      departments: c.departments.map((d) => d.code),
      subscriptions: c.subscriptions.map(subscriptionView),
      entitlements: current
        ? entitlementView(readSnapshot(current.entitlements, current.plan))
        : null,
      members: c.members.map((m) => ({ email: m.user.email, status: m.user.status, role: m.role })),
      access: { canEnterCore: canEnterCore(c, current) },
      developmentActivation: this.developmentActivation,
    };
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

function companyFields(c: Company) {
  return {
    id: c.id,
    displayName: c.name,
    legalName: c.legalName,
    taxId: c.taxId,
    registrationNumber: c.registrationNumber,
    status: c.status,
    onboardingStatus: c.onboardingStatus,
    isDemo: c.isDemo,
    createdAt: c.createdAt.toISOString(),
    activatedAt: c.activatedAt?.toISOString() ?? null,
  };
}
