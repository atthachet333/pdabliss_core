import {
  ArrowRight,
  Gift,
  Headset,
  MessagesSquare,
  Rocket,
  ScanSearch,
  ShieldCheck,
  ClipboardList,
  FileCheck2,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Section, SectionHead } from '@/features/departments/ui';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { PRICING, type FaqFacts } from './copy';
import { ANNUAL_POLICY, getPlan, STANDARD_DEPARTMENTS } from './plans';
import { SECTION, useMoney } from './state';
import { DisclosureIcon } from '@/components/ui/DisclosureIcon';
import { disclosureItem, disclosureTrigger } from '@/components/ui/overlay';

/** Enterprise does not use checkout: consultation → requirements → process review → quotation. */
export function EnterpriseFlow() {
  const c = useCopy(PRICING);
  const e = c.enterprise;
  const { href } = useLocale();
  const icons = [MessagesSquare, ClipboardList, ScanSearch, FileCheck2];
  return (
    <Section id={SECTION.enterprise} labelledBy="enterprise-title" className="scroll-mt-20">
      <div className="grid grid-cols-1 gap-12 rounded-[2rem] border border-border-strong bg-surface-base/60 p-6 sm:p-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
        <div>
          <SectionHead id="enterprise-title" eyebrow={e.eyebrow} title={e.title} lead={e.lead} />
          <p className="mt-8 text-caption font-semibold text-text-muted">{e.suitable}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {e.suitableItems.map((s) => (
              <li
                key={s}
                className="rounded-full border border-border-soft px-3 py-1.5 text-label text-text-secondary"
              >
                {s}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to={href('/contact?interest=enterprise&plan=enterprise')}
              className={buttonClasses('primary', 'lg')}
            >
              {e.quote}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              to={href('/contact?interest=consulting')}
              className={buttonClasses('secondary', 'lg')}
            >
              {e.talk}
            </Link>
          </div>
        </div>
        <div>
          <ol className="relative space-y-3" data-enterprise-flow>
            <span
              aria-hidden
              className="absolute top-6 bottom-6 left-[1.375rem] w-px bg-border-strong"
            />
            {e.steps.map((s, i) => {
              const Icon = icons[i]!;
              return (
                <li key={s.title} className="relative flex gap-4 rounded-2xl p-2">
                  <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-raised">
                    <Icon className="size-5 text-text-secondary" aria-hidden />
                  </span>
                  <div className="pt-1">
                    <p className="text-caption text-text-muted tabular">
                      {String(i + 1).padStart(2, '0')}
                    </p>
                    <p className="text-body font-semibold text-text-primary">{s.title}</p>
                    <p className="mt-0.5 text-label text-text-secondary">{s.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 text-caption text-text-muted">{e.scopeNote}</p>
        </div>
      </div>
    </Section>
  );
}

/** Launch benefits — calm, no countdowns, no crossed-out prices. */
export function EarlyAccess() {
  const c = useCopy(PRICING);
  const x = c.early;
  const { href } = useLocale();
  const icons = [Rocket, Gift, Headset, ShieldCheck];
  return (
    <Section id={SECTION.early} labelledBy="early-title" className="scroll-mt-20">
      <div className="relative overflow-hidden rounded-[2rem] border border-border-brand/50 bg-[radial-gradient(ellipse_60%_80%_at_15%_0%,rgb(25_195_154/0.16),transparent_70%),radial-gradient(ellipse_50%_60%_at_100%_100%,rgb(25_195_154/0.08),transparent_70%)] p-6 sm:p-10">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 size-72 rounded-full border border-brand-glow/15"
        />
        <div
          aria-hidden
          className="absolute -top-12 -right-12 size-48 rounded-full border border-brand-glow/20"
        />
        <SectionHead id="early-title" eyebrow={x.eyebrow} title={x.title} lead={x.lead} />
        {/* EP18: one framed surface; the benefits are divided columns, not cards in a card. */}
        <ul className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {x.benefits.map((b, i) => {
            const Icon = icons[i]!;
            return (
              <li key={b.title} className="border-t border-border-soft pt-5">
                <Icon className="size-5 text-brand-glow" aria-hidden />
                <p className="mt-3 text-body font-semibold text-text-primary">{b.title}</p>
                <p className="mt-1 text-label text-text-secondary">{b.body}</p>
              </li>
            );
          })}
        </ul>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-caption text-text-muted">{x.note}</p>
          <Link
            to={href('/contact?interest=plans')}
            className={buttonClasses('secondary', 'md', 'shrink-0')}
          >
            {x.cta}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </Section>
  );
}

/** FAQ answers are built from plans.ts, so they cannot drift from the plan data. */
export function PricingFaq() {
  const c = useCopy(PRICING);
  const money = useMoney();
  const [open, setOpen] = useState<number | null>(0);
  const facts: FaqFacts = {
    starter: money(getPlan('starter').monthlyPrice!),
    business: money(getPlan('business').monthlyPrice!),
    professional: money(getPlan('professional').monthlyPrice!),
    starterDepts: getPlan('starter').departmentLimit as number,
    businessDepts: getPlan('business').departmentLimit as number,
    standardDepts: STANDARD_DEPARTMENTS.length,
    year2Months: ANNUAL_POLICY.year2PaidMonths,
    year3Discount: ANNUAL_POLICY.year3DiscountPercent,
  };
  // Reading order stays 1…n: the first half fills the left column, the rest the right.
  const indexed = c.faq.items.map((item, i) => ({ item, i }));
  const half = Math.ceil(indexed.length / 2);
  const columns = [indexed.slice(0, half), indexed.slice(half)];
  return (
    <Section id={SECTION.faq} labelledBy="faq-title" className="scroll-mt-20">
      <SectionHead id="faq-title" eyebrow={c.faq.eyebrow} title={c.faq.title} />
      {/* Desktop: two independent columns, so opening an answer never shifts the other column. */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 lg:gap-x-12">
        {columns.map((col, ci) => (
          <ul key={ci} data-faq-column={ci} className={cn('space-y-2', ci === 1 && 'mt-2 lg:mt-0')}>
            {col.map(({ item, i }) => {
              const isOpen = open === i;
              return (
                <li key={item.q} data-faq={i} className={disclosureItem(isOpen)}>
                  <h3>
                    <button
                      type="button"
                      id={`faq-q-${i}`}
                      aria-expanded={isOpen}
                      aria-controls={`faq-a-${i}`}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className={cn(disclosureTrigger, 'text-body font-medium text-text-primary')}
                    >
                      {item.q}
                      <DisclosureIcon open={isOpen} />
                    </button>
                  </h3>
                  <div
                    // EP19: no region role — fifteen answers would flood the landmark list;
                    // the button's aria-controls / aria-expanded carry the relationship.
                    id={`faq-a-${i}`}
                    hidden={!isOpen}
                    className="px-5 pb-5 text-label leading-relaxed text-text-secondary"
                  >
                    {item.a(facts)}
                  </div>
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </Section>
  );
}

export function PricingCta() {
  const c = useCopy(PRICING);
  const { href } = useLocale();
  return (
    <Section labelledBy="pricing-cta" className="pb-24 sm:pb-32">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border-soft bg-[radial-gradient(ellipse_70%_90%_at_50%_0%,rgb(25_195_154/0.14),transparent_70%)] px-6 py-12 text-center sm:px-12">
        <h2 id="pricing-cta" className="mx-auto max-w-2xl text-h2 text-text-primary">
          {c.cta.title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-body text-text-secondary">{c.cta.lead}</p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link to={href('/contact?interest=demo')} className={buttonClasses('primary', 'lg')}>
            {c.cta.demo}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link to={href('/contact?interest=plans')} className={buttonClasses('secondary', 'lg')}>
            {c.cta.consult}
          </Link>
        </div>
      </div>
    </Section>
  );
}
