import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { useId, useState } from 'react';
import { Section, SectionHead } from '@/features/departments/ui';
import { useCopy } from '@/i18n/useCopy';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Segmented } from '@/components/ui/Segmented';
import { PRICING } from './copy';
import { PlanPrice } from './PlanPrice';
import { getPlan, recommendPlan, type DeptRange, type FitAnswers } from './plans';
import { SECTION, scrollToSection, usePricing } from './state';

type YesNo = 'yes' | 'no';
const BOOL_KEYS = ['executive', 'customWorkflow', 'api', 'customReports', 'complex'] as const;

function Question({
  label,
  children,
}: {
  label: string;
  children: (labelId: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3 border-t border-border-soft py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <p id={id} className="text-label text-text-primary">
        {label}
      </p>
      {children(id)}
    </div>
  );
}

/** A few deterministic questions → a starting package. No personal data. */
export function PlanFinder() {
  const c = useCopy(PRICING);
  const f = c.fit;
  const { setPlan, billing } = usePricing();
  const [answers, setAnswers] = useState<FitAnswers>({
    departments: '1-2',
    executive: false,
    customWorkflow: false,
    api: false,
    customReports: false,
    complex: false,
  });
  const result = recommendPlan(answers);
  const plan = getPlan(result.plan);
  const yesNo = [
    { value: 'yes' as const, label: f.yes },
    { value: 'no' as const, label: f.no },
  ];
  const onlyApiOrReports =
    result.plan === 'professional' && result.reasons.every((r) => r === 'apiOrReports');

  return (
    <Section id={SECTION.fit} labelledBy="fit-title" className="scroll-mt-20">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14">
        <div>
          <SectionHead id="fit-title" eyebrow={f.eyebrow} title={f.title} lead={f.lead} />
          <div className="mt-8">
            <Question label={f.departments.label}>
              {(id) => (
                <Segmented<DeptRange>
                  labelledBy={id}
                  size="sm"
                  value={answers.departments}
                  onChange={(departments) => setAnswers((a) => ({ ...a, departments }))}
                  options={(Object.keys(f.departments.options) as DeptRange[]).map((k) => ({
                    value: k,
                    label: f.departments.options[k],
                  }))}
                  className="grid w-full grid-cols-2 sm:w-[24rem]"
                />
              )}
            </Question>
            {BOOL_KEYS.map((k) => (
              <Question key={k} label={f[k]}>
                {(id) => (
                  <Segmented<YesNo>
                    labelledBy={id}
                    size="sm"
                    value={answers[k] ? 'yes' : 'no'}
                    onChange={(v) => setAnswers((a) => ({ ...a, [k]: v === 'yes' }))}
                    options={yesNo}
                    className="w-full shrink-0 sm:w-40"
                  />
                )}
              </Question>
            ))}
          </div>
          <p className="mt-4 inline-flex items-center gap-2 text-caption text-text-muted">
            <ShieldCheck className="size-4 text-brand-glow" aria-hidden />
            {f.privacy}
          </p>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div
            aria-live="polite"
            data-recommendation={plan.id}
            className="rounded-[1.75rem] border border-border-brand/60 bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,rgb(25_195_154/0.12),transparent_70%)] p-6 sm:p-8"
          >
            <p className="text-caption font-semibold text-brand-glow">{f.result}</p>
            <p className="mt-3 text-h2 text-text-primary">{plan.name}</p>
            <p className="mt-1 text-label text-text-secondary">{c.plans[plan.id].tagline}</p>
            <PlanPrice plan={plan} billing={billing} size="sm" className="mt-5" />
            <ul className="mt-5 space-y-2">
              {result.reasons.map((r) => (
                <li key={r} className="flex gap-2.5 text-label text-text-secondary">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-glow" aria-hidden />
                  {f.reasons[r]}
                </li>
              ))}
            </ul>
            {onlyApiOrReports && (
              <p className="mt-4 text-caption text-text-muted">{f.businessAlt}</p>
            )}
            <button
              type="button"
              onClick={() => {
                setPlan(plan.id);
                scrollToSection(SECTION.packages);
              }}
              className={buttonClasses('primary', 'md', 'mt-6 w-full sm:w-auto')}
            >
              {f.view}
              <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </Section>
  );
}
