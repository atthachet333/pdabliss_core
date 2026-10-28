import { ArrowRight, Check, Star } from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Section, SectionHead } from '@/features/departments/ui';
import { tabKeys } from '@/features/departments/tabs';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { CapabilityStack } from './CapabilityStack';
import { BillingToggle } from './controls';
import { PRICING } from './copy';
import { PlanPrice } from './PlanPrice';
import { annualPrices, getPlan, PLANS, type PlanFacts } from './plans';
import { SECTION, scrollToSection, useMoney, usePricing } from './state';
import { departmentAllowance, executiveText, storageText, usersText } from './text';

/** Short price line for a plan tab — monthly, year 1, or quotation. */
function TabPrice({ plan }: { plan: PlanFacts }) {
  const c = useCopy(PRICING);
  const money = useMoney();
  const { billing } = usePricing();
  if (plan.monthlyPrice === null) return <>{c.explorer.quote}</>;
  if (billing === 'monthly') {
    return (
      <>
        <span className="font-semibold text-text-primary tabular">{money(plan.monthlyPrice)}</span>{' '}
        {c.currency.perMonth}
      </>
    );
  }
  return (
    <>
      <span className="font-semibold text-text-primary tabular">
        {money(annualPrices(plan.monthlyPrice).year1)}
      </span>{' '}
      {c.currency.perYear} · {c.years.y1}
    </>
  );
}

/**
 * The package explorer: four plans as layers. The selected plan expands into
 * price, audience, allowances, capabilities, support and its call to action;
 * the other plans stay visible as tabs.
 */
export function PackageExplorer() {
  const c = useCopy(PRICING);
  const { href } = useLocale();
  const { plan: planId, setPlan, billing } = usePricing();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = PLANS.findIndex((p) => p.id === planId);
  const plan = getPlan(planId);
  const t = c.plans[plan.id];
  const v = c.values;
  const quote = plan.cta === 'quote';

  const facts = [
    { label: c.explorer.departments, value: departmentAllowance(plan, v) },
    { label: c.explorer.executive, value: executiveText(plan, v) },
    { label: c.explorer.storage, value: storageText(plan, v) },
    { label: c.explorer.branches, value: v.allBranches },
    { label: c.explorer.users, value: usersText(plan, v) },
    { label: c.explorer.support, value: v.support[plan.support] },
  ];

  return (
    <Section id={SECTION.packages} labelledBy="packages-title" className="scroll-mt-20">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <SectionHead
          id="packages-title"
          eyebrow={c.explorer.eyebrow}
          title={c.explorer.title}
          lead={c.explorer.lead}
        />
        <BillingToggle className="shrink-0" />
      </div>

      {/* Plan tabs — sticky on small screens so the selection stays in reach. */}
      <div className="sticky top-16 z-20 -mx-4 mt-10 bg-surface-base/90 px-4 py-2 backdrop-blur-md sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div
          role="tablist"
          aria-label={c.explorer.tabs}
          onKeyDown={(e) => tabKeys(PLANS.length, active, (i) => setPlan(PLANS[i]!.id), tabs)(e)}
          className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3"
        >
          {PLANS.map((p, i) => {
            const on = p.id === planId;
            return (
              <button
                key={p.id}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                id={`plan-tab-${p.id}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="plan-panel"
                tabIndex={on ? 0 : -1}
                data-plan={p.id}
                onClick={() => setPlan(p.id)}
                className={cn(
                  'relative flex min-h-11 flex-col items-start rounded-2xl border px-3.5 py-2.5 text-left transition-[border-color,background-color] duration-300 sm:px-5 sm:py-4',
                  on
                    ? p.cta === 'quote'
                      ? 'border-border-strong bg-surface-raised'
                      : 'border-border-brand bg-surface-raised shadow-[0_18px_44px_-28px_rgb(25_195_154/0.6)]'
                    : 'border-border-soft bg-surface-base/60 hover:border-border-strong',
                )}
              >
                <span className="hidden text-caption text-text-muted sm:block">
                  {String(p.level + 1).padStart(2, '0')} · {c.layers[p.layer].name}
                </span>
                <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 sm:mt-1.5">
                  <span className="text-label font-semibold text-text-primary sm:text-body-lg">
                    {p.name}
                  </span>
                  {p.recommended && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border-brand bg-brand-primary/10 px-2 py-0.5 text-[0.6875rem] font-medium text-brand-soft">
                      <Star className="size-3" aria-hidden />
                      {c.explorer.recommended}
                    </span>
                  )}
                  {on && <Check className="ml-auto size-4 shrink-0 text-brand-glow" aria-hidden />}
                </span>
                <span className="mt-0.5 text-caption text-text-secondary sm:mt-2 sm:text-label">
                  <TabPrice plan={p} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        id="plan-panel"
        role="tabpanel"
        aria-labelledby={`plan-tab-${plan.id}`}
        data-selected-plan={plan.id}
        className={cn(
          'mt-4 overflow-hidden rounded-[1.75rem] border',
          quote
            ? 'border-border-strong bg-surface-base/70'
            : 'border-border-soft bg-[radial-gradient(ellipse_70%_60%_at_85%_0%,rgb(25_195_154/0.08),transparent_70%)]',
        )}
      >
        <div className="grid grid-cols-1 gap-10 p-5 sm:p-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12 lg:p-10">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-h3 text-text-primary">{plan.name}</h3>
              {plan.recommended && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border-brand bg-brand-primary/10 px-2.5 py-1 text-caption font-medium text-brand-soft">
                  <Star className="size-3.5" aria-hidden />
                  {c.explorer.recommended}
                </span>
              )}
            </div>
            <p className="mt-2 text-body-lg text-text-primary">{t.tagline}</p>
            <p className="mt-2 text-label text-text-secondary">
              <span className="text-text-muted">{c.explorer.forWho}: </span>
              {t.audience}
            </p>

            <PlanPrice plan={plan} billing={billing} className="mt-7" />
            {!quote && (
              <p className="mt-3 text-caption text-text-secondary">
                {billing === 'monthly' ? c.billing.monthlyNote : c.annual.rounding}
              </p>
            )}

            <h4 className="mt-8 text-caption font-semibold text-text-muted">{c.explorer.facts}</h4>
            <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.label} className="border-t border-border-soft pt-3">
                  <dt className="text-caption text-text-muted">{f.label}</dt>
                  <dd className="mt-0.5 text-label font-medium text-text-primary">{f.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {quote ? (
                <>
                  <Link
                    to={href('/consultation?topic=enterprise&plan=enterprise')}
                    className={buttonClasses('primary', 'lg')}
                  >
                    {c.explorer.quote}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <a
                    href={`#${SECTION.enterprise}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(SECTION.enterprise);
                    }}
                    className={buttonClasses('secondary', 'lg')}
                  >
                    {c.explorer.process}
                  </a>
                </>
              ) : (
                <>
                  <Link
                    to={href(`/consultation?topic=demo&plan=${plan.id}`)}
                    className={buttonClasses('primary', 'lg')}
                  >
                    {c.explorer.demo}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <a
                    href={`#${SECTION.configure}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(SECTION.configure);
                    }}
                    className={buttonClasses('secondary', 'lg')}
                  >
                    {c.explorer.configure}
                  </a>
                </>
              )}
            </div>
            <p className="mt-4 text-caption text-text-muted">{c.explorer.change}</p>
          </div>

          <div>
            <CapabilityStack
              level={plan.level}
              label={`${plan.name} · ${c.layers[plan.layer].name}: ${c.layers[plan.layer].gains}`}
              className="mx-auto max-w-[24rem]"
            />
            <p className="mt-2 text-center text-caption text-text-muted">
              {c.explorer.layer} {plan.level + 1} · {c.layers[plan.layer].name} —{' '}
              {c.layers[plan.layer].gains}
            </p>
            <h4 className="mt-8 text-label font-semibold text-text-primary">{t.lead}</h4>
            <ul className="mt-3 space-y-2.5">
              {t.capabilities.map((cap) => (
                <li key={cap} className="flex gap-2.5 text-label text-text-secondary">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-glow" aria-hidden />
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}
