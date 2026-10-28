import { buttonClasses } from '@/components/ui/buttonStyles';
import { Notice } from '@/features/auth/AuthFrame';
import { DEPARTMENT_CODES, planId } from '@/features/company/api';
import { COMPANY_COPY } from '@/features/company/copy';
import { getPlan } from '@/features/pricing/plans';
import { useCopy } from '@/i18n/useCopy';
import { formatNumber } from '@/lib/format';
import { controlApi } from './api';
import { RequirePermission } from './CompanyShell';
import { useControl } from './controlContext';
import { CONTROL_COPY } from './copy';
import { errorText, useDateFormat, useDepartmentName, useLoad } from './model';
import { AreaLink, Fact, Facts, Loading, PageTitle, Pill, Section } from './parts';

/*
 * /company/subscription — the facts of the package (Owner, System Admin,
 * Executive). No invoices, receipts, cards or payment history exist in the
 * system, so none are shown, and nothing pretends to be a checkout: package
 * changes go through the PDA BLISS team.
 */
export function SubscriptionPage() {
  return (
    <RequirePermission permission="company.subscription.view">
      <Subscription />
    </RequirePermission>
  );
}

function Subscription() {
  const c = useCopy(CONTROL_COPY);
  const co = useCopy(COMPANY_COPY);
  const { overview } = useControl();
  const deptName = useDepartmentName();
  const { date } = useDateFormat();
  const { state } = useLoad(controlApi.subscription);

  if (state.status === 'loading') return <Loading label={c.shell.loading} />;
  if (state.status === 'error') return <Notice tone="error">{errorText(state.error, c)}</Notice>;
  const { subscription: sub, entitlements: e, departments, branches } = state.data;
  const plan = getPlan(planId(sub.plan));
  const max = e.maxDepartments === 'CUSTOM' ? DEPARTMENT_CODES.length : e.maxDepartments;

  return (
    <div className="grid gap-8">
      <PageTitle title={c.subscription.title} lead={c.subscription.lead} />
      {overview.company.isDemo && <Notice tone="info">{c.subscription.demo}</Notice>}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section id="plan-title" title={c.subscription.package}>
          <p
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
            data-subscription-plan={sub.plan}
          >
            <span className="text-[1.75rem] font-semibold text-text-primary">{plan.name}</span>
            {state.data.priceVisible && (
              <span className="text-label text-text-secondary">
                {sub.monthlyPriceThb === null
                  ? co.package.quotation
                  : co.package.perMonth(formatNumber(sub.monthlyPriceThb))}
              </span>
            )}
            <Pill tone={sub.status === 'ACTIVE' ? 'teal' : 'warning'}>
              {co.summary.subscriptionStatuses[sub.status]}
            </Pill>
          </p>
          <Facts className="mt-5">
            <Fact term={c.subscription.billingCycle}>{co.billing[sub.billingCycle]}</Fact>
            {sub.activatedAt && (
              <Fact term={c.subscription.activated}>{date(sub.activatedAt)}</Fact>
            )}
            {sub.currentPeriodStart && sub.currentPeriodEnd && (
              <Fact term={c.subscription.period}>
                {date(sub.currentPeriodStart)} – {date(sub.currentPeriodEnd)}
              </Fact>
            )}
            <Fact term={c.subscription.departments}>
              <span className="block">
                {c.departments.used(
                  departments.enabled.length,
                  e.maxDepartments === 'CUSTOM' ? c.departments.custom : String(max),
                )}
              </span>
              <span className="mt-1 flex flex-wrap gap-1.5">
                {departments.enabled.map((d) => (
                  <Pill key={d} tone="muted">
                    {deptName(d)}
                  </Pill>
                ))}
              </span>
            </Fact>
            <Fact term={c.subscription.executive}>
              {e.executiveAllowed ? co.summary.allowed : co.summary.notAllowed}
            </Fact>
            <Fact term={c.subscription.storage}>
              {e.storage === 'CUSTOM' ? co.summary.custom : `${e.storage.gb} GB`}
            </Fact>
            <Fact term={c.subscription.api}>{co.package.api[e.api]}</Fact>
            <Fact term={c.subscription.branches}>{c.subscription.allBranches(branches.total)}</Fact>
            <Fact term={c.subscription.lotExpiry}>{c.subscription.lotExpiryValue}</Fact>
          </Facts>
        </Section>

        <Section id="change-title" title={c.subscription.change}>
          <p className="text-label leading-relaxed text-text-secondary">
            {c.subscription.changeNote}
          </p>
          <AreaLink
            to="/contact"
            className={buttonClasses('secondary', 'md', 'mt-4')}
            data-contact-pda
          >
            {c.subscription.contact}
          </AreaLink>
          <p className="mt-5 text-caption text-text-muted" data-no-invoices>
            {c.subscription.noInvoices}
          </p>
        </Section>
      </div>
    </div>
  );
}
