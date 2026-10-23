import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { fill, PRICING } from './copy';
import { ANNUAL_POLICY, annualPrices, type Billing, type PlanFacts } from './plans';
import { useMoney } from './state';

/**
 * A plan's price for the chosen billing cycle. Annual shows the whole
 * relationship (year 1, year 2, year 3+), never a single "save X%".
 */
export function PlanPrice({
  plan,
  billing,
  size = 'lg',
  className,
}: {
  plan: PlanFacts;
  billing: Billing;
  size?: 'lg' | 'sm';
  className?: string;
}) {
  const c = useCopy(PRICING);
  const money = useMoney();

  if (plan.monthlyPrice === null) {
    return (
      <div className={className} data-price="quote">
        <p
          className={cn('font-semibold text-text-primary', size === 'lg' ? 'text-h3' : 'text-body')}
        >
          {c.explorer.quote}
        </p>
        <p className="mt-1 text-caption text-text-secondary">{c.explorer.quoteLead}</p>
      </div>
    );
  }

  if (billing === 'monthly') {
    return (
      <p className={cn('flex flex-wrap items-baseline gap-x-2', className)} data-price="monthly">
        <span
          className={cn(
            'leading-none font-semibold text-text-primary tabular',
            size === 'lg' ? 'text-[2.75rem]' : 'text-h3',
          )}
        >
          {money(plan.monthlyPrice)}
        </span>
        <span className="text-label text-text-secondary">{c.currency.perMonth}</span>
      </p>
    );
  }

  const a = annualPrices(plan.monthlyPrice);
  const rows = [
    { year: c.years.y1, rule: c.years.y1Rule, amount: money(a.year1) },
    {
      year: c.years.y2,
      rule: fill(c.years.y2Rule, { paid: ANNUAL_POLICY.year2PaidMonths }),
      amount: money(a.year2),
    },
    {
      year: c.years.y3,
      rule: fill(c.years.y3Rule, { pct: ANNUAL_POLICY.year3DiscountPercent }),
      amount: `${c.currency.approx} ${money(a.year3)}`,
    },
  ];
  return (
    <dl
      className={cn('divide-y divide-border-soft rounded-2xl border border-border-soft', className)}
      data-price="annual"
    >
      {rows.map((r) => (
        <div key={r.year} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
          <dt>
            <span className="block text-label font-medium text-text-primary">{r.year}</span>
            <span className="block text-caption text-text-muted">{r.rule}</span>
          </dt>
          <dd className="shrink-0 text-right">
            <span
              className={cn(
                'font-semibold text-text-primary tabular',
                size === 'lg' ? 'text-body-lg' : 'text-label',
              )}
            >
              {r.amount}
            </span>
            <span className="ml-1 text-caption text-text-muted">{c.currency.perYear}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
