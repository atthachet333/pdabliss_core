import {
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  CalendarCheck,
  GitBranch,
  Store,
} from 'lucide-react';
import { useMediaQuery } from '@/components/core/hooks';
import { Section, SectionHead } from '@/features/departments/ui';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { fill, PRICING } from './copy';
import { ANNUAL_POLICY, annualPrices, PLANS } from './plans';
import { SECTION, useMoney } from './state';

/** One company, every branch, one workspace — and why CORE is priced per company. */
export function CompanyModel() {
  const c = useCopy(PRICING).company;
  const branches = [1, 2, 3, 4];
  return (
    <Section id={SECTION.company} labelledBy="company-title" className="scroll-mt-20">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <div>
          <SectionHead id="company-title" eyebrow={c.eyebrow} title={c.title} lead={c.lead} />
          <ul className="mt-8 space-y-4">
            {c.points.map((p) => (
              <li key={p.title} className="border-l-2 border-border-brand/60 pl-4">
                <p className="text-label font-semibold text-text-primary">{p.title}</p>
                <p className="mt-0.5 text-label text-text-secondary">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <figure aria-label={c.diagram.label}>
          <div className="relative rounded-[1.75rem] border border-border-brand/50 bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,rgb(25_195_154/0.12),transparent_70%)] p-5 sm:p-8">
            <p className="text-caption font-semibold text-brand-glow">{c.diagram.workspace}</p>
            <div className="mt-5 flex flex-col items-center">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-border-strong bg-surface-raised px-5 py-3">
                <Building2 className="size-5 text-brand-glow" aria-hidden />
                <span className="text-label font-semibold text-text-primary">
                  {c.diagram.company}
                </span>
              </div>
              <span aria-hidden className="h-6 w-px bg-border-brand/60" />
              <div className="inline-flex items-center gap-2 rounded-xl border border-border-soft bg-surface-base px-4 py-2.5">
                <Store className="size-4 text-brand-glow" aria-hidden />
                <span className="text-label text-text-primary">{c.diagram.hq}</span>
              </div>
              <span aria-hidden className="h-6 w-px bg-border-brand/60" />
              <ul className="relative grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4">
                <span
                  aria-hidden
                  className="absolute -top-px right-[12%] left-[12%] hidden h-px bg-border-brand/60 sm:block"
                />
                {branches.map((n) => (
                  <li
                    key={n}
                    className="flex items-center justify-center gap-2 rounded-xl border border-border-soft bg-surface-base px-3 py-2.5"
                  >
                    <GitBranch className="size-4 text-brand-glow" aria-hidden />
                    <span className="text-label text-text-secondary">
                      {fill(c.diagram.branch, { n })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-border-soft bg-surface-base/70 p-5">
            <p className="text-label font-semibold text-text-primary">{c.whyTitle}</p>
            <p className="mt-1.5 text-label text-text-secondary">{c.why}</p>
          </div>
        </figure>
      </div>
    </Section>
  );
}

/** Monthly flexibility vs. the three-step annual relationship. */
export function AnnualRelationship() {
  const c = useCopy(PRICING);
  const a = c.annual;
  const money = useMoney();
  const wide = useMediaQuery('(min-width: 48rem)');
  const priced = PLANS.filter((p) => p.monthlyPrice !== null);
  const enterprise = PLANS.find((p) => p.monthlyPrice === null)!;
  const steps = [
    { year: c.years.y1, rule: c.years.y1Rule },
    { year: c.years.y2, rule: fill(c.years.y2Rule, { paid: ANNUAL_POLICY.year2PaidMonths }) },
    { year: c.years.y3, rule: fill(c.years.y3Rule, { pct: ANNUAL_POLICY.year3DiscountPercent }) },
  ];
  const cols = [a.table.monthly, c.years.y1, c.years.y2, c.years.y3];
  const amounts = (monthly: number) => {
    const y = annualPrices(monthly);
    return [
      `${money(monthly)} ${c.currency.perMonth}`,
      money(y.year1),
      money(y.year2),
      `${c.currency.approx} ${money(y.year3)}`,
    ];
  };

  return (
    <Section id={SECTION.billing} labelledBy="billing-title" className="scroll-mt-20">
      <SectionHead id="billing-title" eyebrow={a.eyebrow} title={a.title} lead={a.lead} />

      <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2.2fr)]">
        <article className="rounded-[1.5rem] border border-border-soft bg-surface-base/70 p-6">
          <p className="text-caption text-text-muted">{a.monthly.sub}</p>
          <h3 className="mt-2 text-h3 text-text-primary">{a.monthly.title}</h3>
          <p className="mt-3 text-label text-text-secondary">{a.monthly.body}</p>
        </article>
        <article className="rounded-[1.5rem] border border-border-brand/50 bg-[radial-gradient(ellipse_70%_80%_at_80%_0%,rgb(25_195_154/0.1),transparent_70%)] p-6">
          <p className="text-caption text-brand-glow">{a.annual.sub}</p>
          <h3 className="mt-2 text-h3 text-text-primary">{a.annual.title}</h3>
          <p className="mt-3 text-label text-text-secondary">{a.annual.body}</p>
          {/* Three-step relationship timeline */}
          <ol className="relative mt-7 grid gap-5 sm:grid-cols-3 sm:gap-4">
            <span
              aria-hidden
              className="absolute top-5 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-border-brand/40 via-brand-glow/60 to-brand-glow sm:block"
            />
            {steps.map((s, i) => (
              <li
                key={s.year}
                className="relative flex gap-4 sm:flex-col sm:items-center sm:text-center"
              >
                <span
                  className={cn(
                    'relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border text-label font-semibold tabular',
                    i === 2
                      ? 'border-brand-glow bg-brand-primary text-text-inverse'
                      : 'border-border-brand bg-surface-raised text-text-primary',
                  )}
                >
                  {i + 1}
                </span>
                <div className="sm:mt-3">
                  <p className="text-caption text-text-muted">{a.stepTitles[i]}</p>
                  <p className="text-label font-semibold text-text-primary">{s.year}</p>
                  <p className="mt-0.5 text-label text-text-secondary">{s.rule}</p>
                </div>
              </li>
            ))}
          </ol>
        </article>
      </div>

      {/* Amounts per package */}
      <div className="mt-6">
        {wide ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-border-soft">
            <table className="w-full text-left text-label">
              <caption className="sr-only">{a.table.caption}</caption>
              <thead className="bg-surface-raised/70">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-medium text-text-muted">
                    {a.table.plan}
                  </th>
                  {cols.map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-5 py-3.5 text-right font-medium text-text-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {priced.map((p) => (
                  <tr key={p.id} data-annual-row={p.id} className="border-t border-border-soft">
                    <th scope="row" className="px-5 py-3.5 font-semibold text-text-primary">
                      {p.name}
                    </th>
                    {amounts(p.monthlyPrice!).map((v, i) => (
                      <td key={i} className="px-5 py-3.5 text-right text-text-primary tabular">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-border-soft">
                  <th scope="row" className="px-5 py-3.5 font-semibold text-text-primary">
                    {enterprise.name}
                  </th>
                  <td colSpan={4} className="px-5 py-3.5 text-right text-text-secondary">
                    {c.explorer.quote}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="space-y-3">
            {priced.map((p) => (
              <li
                key={p.id}
                data-annual-row={p.id}
                className="rounded-2xl border border-border-soft p-4"
              >
                <p className="text-label font-semibold text-text-primary">{p.name}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                  {amounts(p.monthlyPrice!).map((v, i) => (
                    <div key={i}>
                      <dt className="text-caption text-text-muted">{cols[i]}</dt>
                      <dd className="text-label text-text-primary tabular">{v}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
            <li className="flex items-center justify-between rounded-2xl border border-border-soft p-4">
              <span className="text-label font-semibold text-text-primary">{enterprise.name}</span>
              <span className="text-label text-text-secondary">{c.explorer.quote}</span>
            </li>
          </ul>
        )}
        <p className="mt-3 text-caption text-text-muted">
          {a.rounding} {a.presentation} {c.currency.note}
        </p>
      </div>

      {/* Change and cancellation policy */}
      <div className="mt-10 rounded-[1.5rem] border border-border-soft bg-surface-base/70 p-6">
        <h3 className="text-body-lg font-semibold text-text-primary">{a.change.title}</h3>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { icon: ArrowUpCircle, text: a.change.upgrade },
            { icon: ArrowDownCircle, text: a.change.downgrade },
            { icon: CalendarCheck, text: a.change.cancel },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-label text-text-secondary">
              <Icon className="mt-0.5 size-5 shrink-0 text-brand-glow" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
