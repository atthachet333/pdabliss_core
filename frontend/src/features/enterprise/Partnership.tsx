import { ArrowRight, BadgeCheck, ChevronRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Chapter, Frame, Kicker, Stage } from '@/components/editorial/Layout';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useDepartments } from '@/config/departments';
import { PLANS } from '@/features/pricing/plans';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { GuideLink } from '@/features/resources/GuideLink';
import { ENTERPRISE } from './copy';
import {
  CHAPTER,
  CROSS_LINKS,
  ENTERPRISE_PLAN,
  JOURNEY,
  PHASES,
  PRINCIPLES,
  QUOTE_FLOW,
  READINESS,
  RELATIONSHIP,
} from './model';
import { Head, Note, StatusTag } from './parts';

/* ------------------------------------------------------------------ */
/* 10 Implementation journey — one continuous roadmap                   */
/* ------------------------------------------------------------------ */

export function ImplementationChapter() {
  const c = useCopy(ENTERPRISE).implementation;
  const number = (id: string) => String(JOURNEY.findIndex((j) => j.id === id) + 1).padStart(2, '0');
  return (
    <Chapter id={CHAPTER.implementation} labelledBy="implementation-title" space="lg">
      <Frame width="full">
        <Head eyebrow={c.eyebrow} id="implementation-title" title={c.title} lead={c.lead} />

        <ol data-journey className="relative mt-16 grid grid-cols-1 gap-0 lg:grid-cols-6 lg:gap-4">
          {/* The road */}
          <span
            aria-hidden
            className="absolute top-2 bottom-2 left-[0.6875rem] w-px bg-[linear-gradient(to_bottom,rgb(62_240_192/0.7),rgb(62_240_192/0.15))] lg:top-[0.6875rem] lg:right-0 lg:bottom-auto lg:left-0 lg:h-px lg:w-auto lg:bg-[linear-gradient(90deg,rgb(62_240_192/0.7),rgb(62_240_192/0.2))]"
          />
          {PHASES.map((ph) => (
            <li key={ph} data-phase={ph} className="relative pb-10 pl-10 lg:pb-0 lg:pl-0">
              <span
                aria-hidden
                className="absolute top-0 left-0 flex size-[1.375rem] items-center justify-center rounded-full bg-surface-dark shadow-[inset_0_0_0_2px_rgb(62_240_192/0.7)] lg:relative"
              >
                <span className="size-2 rounded-full bg-brand-glow" />
              </span>
              <p className="text-caption font-semibold tracking-[0.12em] text-brand-soft lg:mt-5">
                {c.phases[ph].name}
              </p>
              <p className="mt-1 text-label text-text-secondary">{c.phases[ph].body}</p>
              <ol className="mt-4 space-y-3 lg:mt-6">
                {JOURNEY.filter((j) => j.phase === ph).map((j) => (
                  <li
                    key={j.id}
                    data-journey-step={j.id}
                    className="rounded-2xl bg-white/[0.035] px-4 py-3.5"
                  >
                    <p className="text-caption text-text-muted tabular">{number(j.id)}</p>
                    <p className="mt-1 text-label font-semibold text-text-primary">
                      {c.steps[j.id].title}
                    </p>
                    <p className="mt-1 text-caption text-text-secondary">{c.steps[j.id].body}</p>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>

        <div className="mx-auto mt-20 grid max-w-[1240px] grid-cols-1 gap-10 border-t border-border-soft pt-12 md:grid-cols-2 md:gap-16">
          <div data-migration>
            <Kicker tone="clear">{c.migration.title}</Kicker>
            <p className="mt-4 text-body text-text-secondary">{c.migration.scope}</p>
            {/* EP17: the ten steps and the preparation checklist, in full. */}
            <GuideLink id="implementationGuide" className="mt-4" />
          </div>
          <div data-training>
            <Kicker tone="clear">{c.training.title}</Kicker>
            <p className="mt-4 text-body text-text-secondary">{c.training.body}</p>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-label text-text-primary">
              {c.training.kinds.map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <span aria-hidden className="size-1 rounded-full bg-brand-glow" />
                  {k}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 11 Support — an ascending ladder                                     */
/* ------------------------------------------------------------------ */

export function SupportChapter() {
  const c = useCopy(ENTERPRISE).support;
  return (
    <Chapter id={CHAPTER.support} labelledBy="support-title" plane="navy">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)] lg:items-end lg:gap-20">
          <div>
            <Head eyebrow={c.eyebrow} id="support-title" title={c.title} lead={c.lead} />
            <p className="mt-10 text-caption font-semibold text-text-muted">
              {c.relationshipTitle}
            </p>
            <ul
              className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-label text-text-primary sm:grid-cols-3"
              data-relationship
            >
              {RELATIONSHIP.map((r, i) => (
                <li key={r} className="flex items-baseline gap-2">
                  <span aria-hidden className="text-caption text-text-muted tabular">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {c.relationship[r]}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <ol
              data-support-ladder
              className="grid grid-cols-1 gap-3 sm:h-80 sm:grid-cols-4 sm:items-end"
            >
              {PLANS.map((p, i) => (
                <li
                  key={p.id}
                  data-support-plan={p.id}
                  data-support={p.support}
                  style={{
                    ['--h' as string]: `${40 + i * 20}%`,
                    ['--w' as string]: `${70 + i * 10}%`,
                  }}
                  className={cn(
                    'flex w-[var(--w)] flex-col justify-end rounded-2xl px-4 py-4 sm:h-[var(--h)] sm:w-auto',
                    p.id === 'enterprise'
                      ? 'bg-[linear-gradient(180deg,rgb(62_224_180/0.24),rgb(62_224_180/0.06))] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)]'
                      : 'bg-white/[0.04]',
                  )}
                >
                  <p className="text-caption text-text-muted">{p.name}</p>
                  <p className="mt-1 text-body font-semibold text-text-primary">
                    {c.levels[p.support].name}
                  </p>
                  <p className="mt-1 text-caption text-text-secondary">
                    {c.levels[p.support].body}
                  </p>
                </li>
              ))}
            </ol>
            <Note className="mt-8">
              <span data-sla-note>{c.slaNote}</span>
            </Note>
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 12 Readiness — a layered stack with honest statuses                  */
/* ------------------------------------------------------------------ */

export function ReadinessChapter() {
  const c = useCopy(ENTERPRISE).readiness;
  return (
    <Chapter id={CHAPTER.readiness} labelledBy="readiness-title" plane="deep" space="lg">
      <Frame width="base">
        <Head eyebrow={c.eyebrow} id="readiness-title" title={c.title} lead={c.lead} />

        <p
          data-readiness-banner
          className="mt-10 flex items-start gap-3 rounded-2xl bg-[rgb(245_184_75/0.07)] px-5 py-4 text-label text-text-primary shadow-[inset_0_0_0_1px_rgb(245_184_75/0.25)]"
        >
          <BadgeCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          {c.banner}
        </p>

        <Stage glow="executive" className="mt-10 p-3 sm:p-5">
          <ol data-readiness className="space-y-1.5">
            {READINESS.map((l, i) => (
              <li
                key={l.id}
                data-readiness-layer={l.id}
                data-status={l.status}
                className="grid grid-cols-1 gap-1 rounded-xl bg-white/[0.035] px-4 py-3.5 sm:grid-cols-[3rem_10rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-5"
              >
                <span aria-hidden className="hidden text-caption text-text-muted tabular sm:block">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-label font-semibold text-text-primary">
                  {c.layers[l.id].name}
                </span>
                <span className="text-label text-text-secondary">{c.layers[l.id].body}</span>
                <StatusTag status={l.status} />
              </li>
            ))}
          </ol>
        </Stage>

        <div className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-14">
          <div>
            <Kicker tone="clear">{c.principlesTitle}</Kicker>
            <p className="mt-4 text-body text-text-primary">{c.principlesLead}</p>
          </div>
          <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2" data-principles>
            {PRINCIPLES.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-label text-text-secondary">
                <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-glow" />
                {c.principles[p]}
              </li>
            ))}
          </ul>
        </div>
        <Note className="mt-10">
          <span data-production-note>{c.productionNote}</span>
        </Note>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 13 Consultation — the path to a quotation                            */
/* ------------------------------------------------------------------ */

export function ConsultChapter() {
  const all = useCopy(ENTERPRISE);
  const c = all.consult;
  const { href } = useLocale();
  const departments = useDepartments();
  return (
    <Chapter
      id={CHAPTER.consult}
      labelledBy="consult-title"
      plane="clear"
      space="lg"
      className="pb-32 sm:pb-40"
    >
      <Frame width="base">
        <Head eyebrow={c.eyebrow} id="consult-title" title={c.title} lead={c.lead} center />

        <ol
          data-quote-flow
          className="mx-auto mt-12 flex max-w-5xl flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-center"
        >
          {QUOTE_FLOW.map((s, i) => (
            <li key={s} className="flex items-center gap-2 sm:gap-1">
              <span
                className={cn(
                  'flex min-h-11 flex-1 items-center gap-2 rounded-full px-4 text-label',
                  s === 'quotation'
                    ? 'bg-brand-primary/20 font-medium text-text-primary'
                    : 'bg-white/[0.04] text-text-secondary',
                )}
              >
                {/* EP19: on the emerald-tinted step the number takes the soft brand tone (AA). */}
                <span
                  className={cn(
                    'text-caption tabular',
                    s === 'quotation' ? 'text-brand-soft' : 'text-text-muted',
                  )}
                >
                  {i + 1}
                </span>
                {c.flow[s]}
              </span>
              {i < QUOTE_FLOW.length - 1 && (
                <ChevronRight aria-hidden className="hidden size-4 text-text-muted sm:block" />
              )}
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            to={href('/contact?interest=enterprise')}
            data-cta="quote"
            className={buttonClasses('primary', 'lg')}
          >
            {all.common.quote}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            to={href('/contact?interest=consulting')}
            data-cta="talk"
            className={buttonClasses('secondary', 'lg')}
          >
            {all.common.talk}
          </Link>
        </div>
        <div className="mt-5 text-center">
          <Link
            to={href(`/pricing?plan=${ENTERPRISE_PLAN}`)}
            data-cta="pricing"
            className="inline-flex min-h-11 min-w-11 items-center gap-1.5 text-label text-text-secondary hover:text-text-primary"
          >
            {all.common.pricing}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        {/* Where to read next — locale preserved */}
        <nav
          aria-label={c.relatedTitle}
          className="mx-auto mt-20 grid max-w-4xl grid-cols-1 gap-10 border-t border-border-soft pt-10 sm:grid-cols-3"
        >
          <div>
            <Kicker tone="muted">{all.common.solutionsLink}</Kicker>
            <ul className="mt-2">
              {CROSS_LINKS.solutions.map((to, i) => (
                <li key={to}>
                  <Link
                    to={href(to)}
                    data-related={to}
                    className="inline-flex min-h-11 min-w-11 items-center gap-1.5 text-label text-text-secondary hover:text-text-primary"
                  >
                    {c.solutions[i]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Kicker tone="muted">{all.common.workflowLink}</Kicker>
            <ul className="mt-2">
              {CROSS_LINKS.workflow.map((to, i) => (
                <li key={to}>
                  <Link
                    to={href(to)}
                    data-related={to}
                    className="inline-flex min-h-11 min-w-11 items-center gap-1.5 text-label text-text-secondary hover:text-text-primary"
                  >
                    {c.workflow[i]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Kicker tone="muted">{c.departmentsTitle}</Kicker>
            <ul className="mt-2">
              {CROSS_LINKS.departments.map((d) => (
                <li key={d}>
                  <Link
                    to={href(`/departments/${d}`)}
                    data-related={`/departments/${d}`}
                    className="inline-flex min-h-11 items-center gap-2 text-label text-text-secondary hover:text-text-primary"
                  >
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: `var(--color-ws-${d})` }}
                    />
                    {departments.find((x) => x.id === d)!.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </Frame>
    </Chapter>
  );
}
