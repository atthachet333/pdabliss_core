import {
  ArrowRight,
  Bell,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  ListOrdered,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { tabKeys } from '@/features/departments/tabs';
import { Section, SectionHead } from '@/features/departments/ui';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { Segmented } from '@/components/ui/Segmented';
import { fill } from '@/lib/fill';
import { PLANS } from '@/features/pricing/plans';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { WORKFLOW } from './copy';
import {
  ADAPTATIONS,
  buildRoute,
  CHAPTER,
  DEFAULT_DECISIONS,
  provenance,
  RECORDS,
  ROLE_FOCUS,
  ROLES,
  TRACE,
  type Adaptation,
} from './model';
import { laneColor, useLaneName, useWorkflow } from './state';
import { LaneChip, RouteView, StatusBadge } from './visuals';

/* 09 — the same route, three perspectives */
export function RolesChapter() {
  const c = useCopy(WORKFLOW);
  const r = c.roles;
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const role = ROLES[active]!;
  const focus = ROLE_FOCUS[role];
  const route = buildRoute(DEFAULT_DECISIONS);
  // What each role is shown: employees and managers see their steps; executives see signals.
  const steps = route.steps.map((s) =>
    role === 'executive' && focus.steps.includes(s.id)
      ? { ...s, status: s.id === 'depositRequest' ? ('waiting' as const) : ('attention' as const) }
      : role === 'manager' && s.id === 'depositRequest'
        ? { ...s, status: 'waiting' as const }
        : s,
  );
  const t = r.roles[role];
  return (
    <Section id={CHAPTER.roles} labelledBy="roles-title" className="scroll-mt-20">
      <SectionHead id="roles-title" eyebrow={r.eyebrow} title={r.title} lead={r.lead} />
      <div
        role="tablist"
        aria-label={r.tabs}
        onKeyDown={(e) => tabKeys(ROLES.length, active, setActive, tabs)(e)}
        className="mt-10 grid grid-cols-3 gap-2 sm:max-w-xl"
      >
        {ROLES.map((ro, i) => (
          <button
            key={ro}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            id={`role-tab-${ro}`}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls="role-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cn(
              'flex min-h-11 flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors duration-200',
              i === active
                ? 'border-border-brand bg-surface-raised'
                : 'border-border-soft hover:border-border-strong',
            )}
          >
            <span className="text-label font-semibold text-text-primary">{r.roles[ro].name}</span>
            <span className="hidden text-caption text-text-muted sm:block">
              {r.roles[ro].question}
            </span>
          </button>
        ))}
      </div>
      <div
        id="role-panel"
        role="tabpanel"
        aria-labelledby={`role-tab-${role}`}
        data-role={role}
        className="mt-4 grid grid-cols-1 gap-6 rounded-[1.75rem] border border-border-soft bg-surface-base/60 p-4 sm:p-6"
      >
        <div className="min-w-0">
          <RouteView
            steps={steps}
            emphasis={focus.steps}
            collapse
            label={`${t.name}: ${t.question}`}
          />
        </div>
        <div>
          <p className="text-h3 text-text-primary">“{t.question}”</p>
          <p className="mt-1 text-caption text-text-muted">{t.who}</p>
          <p className="mt-5 text-caption font-semibold text-text-muted">{r.focus}</p>
          <ul className="mt-2 space-y-2" data-role-items>
            {t.items.map((item) => (
              <li key={item} className="flex gap-2 text-label text-text-secondary">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-glow" />
                {item}
              </li>
            ))}
          </ul>
          {role === 'executive' && (
            <p className="mt-5 text-caption text-text-muted">{r.executiveNote}</p>
          )}
          {role !== 'executive' && (
            <div className="mt-5">
              <LaneChip lane={focus.lane} />
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

/* 10 — the trace: from status history to cross-department provenance */
export function TraceChapter() {
  const c = useCopy(WORKFLOW);
  const t = c.trace;
  const laneName = useLaneName();
  const [view, setView] = useState<'history' | 'provenance'>('history');
  const chain = provenance(TRACE);
  return (
    <Section id={CHAPTER.trace} labelledBy="trace-title" className="scroll-mt-20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <SectionHead id="trace-title" eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
        <Segmented<'history' | 'provenance'>
          label={t.viewsLabel}
          value={view}
          onChange={setView}
          options={[
            { value: 'history', label: t.views.history },
            { value: 'provenance', label: t.views.provenance },
          ]}
          className="grid w-full shrink-0 grid-cols-2 sm:w-auto"
        />
      </div>
      <div
        className="mt-10 rounded-[1.75rem] border border-border-soft bg-surface-base/60 p-5 sm:p-8"
        data-trace-view={view}
      >
        <p className="text-caption text-text-muted tabular">
          {RECORDS.salesOrder} · {c.common.example}
        </p>
        {view === 'history' ? (
          <ol className="relative mt-5 space-y-1" data-trace>
            <span
              aria-hidden
              className="absolute top-3 bottom-3 left-[1.0625rem] w-px bg-border-soft"
            />
            {TRACE.map((e, i) => (
              <li
                key={`${e.event}-${i}`}
                data-trace-event={e.event}
                className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 py-2 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto]"
              >
                <span
                  aria-hidden
                  className="relative z-10 flex size-9 items-center justify-center rounded-full border bg-surface-base text-caption font-semibold text-text-secondary tabular"
                  style={{ borderColor: laneColor(e.role) }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-label font-medium text-text-primary">
                    {t.events[e.event]} · {c.common.steps[e.step].title}
                  </p>
                  <p className="text-caption text-text-muted">
                    <span className="sr-only">
                      {t.order} {i + 1}.{' '}
                    </span>
                    {t.by} {laneName(e.role)}
                  </p>
                </div>
                <StatusBadge
                  status={e.status}
                  className="col-start-2 sm:col-start-auto sm:self-center"
                />
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-5">
            <p className="text-caption font-semibold text-text-muted">{t.handoffs}</p>
            <ol className="mt-3 flex flex-wrap items-center gap-2" data-provenance>
              {chain.map((lane, i) => (
                <li key={`${lane}-${i}`} className="flex items-center gap-2">
                  <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-soft bg-surface-raised px-3 text-label text-text-primary">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: laneColor(lane) }}
                    />
                    {laneName(lane)}
                    <span className="text-caption text-text-muted tabular">
                      ×
                      {TRACE.filter((e, j) => e.role === lane && chainIndex(TRACE, j) === i).length}
                    </span>
                  </span>
                  {i < chain.length - 1 && (
                    <ArrowRight aria-hidden className="size-4 text-brand-glow" />
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
        <p className="mt-6 text-caption text-text-muted">{t.note}</p>
      </div>
    </Section>
  );
}

/** Which provenance segment a trace entry belongs to. */
function chainIndex(trace: typeof TRACE, j: number): number {
  let seg = 0;
  for (let i = 1; i <= j; i++) if (trace[i]!.role !== trace[i - 1]!.role) seg++;
  return seg;
}

/* 11 — replay the flow, step by step */
export function ReplayChapter() {
  const c = useCopy(WORKFLOW);
  const r = c.replay;
  const laneName = useLaneName();
  const reduce = usePrefersReducedMotion();
  const { decisions } = useWorkflow();
  const steps = buildRoute(decisions).steps;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const total = steps.length;
  const current = Math.min(index, total - 1);
  const atEnd = current >= total - 1;
  const step = steps[current]!;
  const autoplay = playing && !reduce && !atEnd;

  useEffect(() => {
    if (!autoplay) return;
    const t = window.setTimeout(() => setIndex((i) => i + 1), 1600);
    return () => window.clearTimeout(t);
  }, [autoplay, current]);

  const control =
    'inline-flex size-11 items-center justify-center rounded-full border border-border-strong text-text-secondary transition-colors hover:border-border-brand hover:text-text-primary disabled:opacity-40';

  return (
    <Section id={CHAPTER.replay} labelledBy="replay-title" className="scroll-mt-20">
      <SectionHead id="replay-title" eyebrow={r.eyebrow} title={r.title} lead={r.lead} />
      <div className="mt-10 rounded-[1.75rem] border border-border-soft bg-surface-base/60 p-4 sm:p-6">
        <RouteView
          steps={steps}
          current={current}
          collapse
          label={fill(r.stepOf, { n: current + 1, total })}
        />
        <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="group"
            aria-label={r.controlsLabel}
            className="flex items-center gap-2"
            data-replay-controls
          >
            <button
              type="button"
              aria-label={r.controls.restart}
              onClick={() => {
                setIndex(0);
                setPlaying(false);
              }}
              className={control}
            >
              <RotateCcw className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={r.controls.prev}
              disabled={current === 0}
              onClick={() => {
                setIndex((i) => Math.max(0, Math.min(i, total - 1) - 1));
                setPlaying(false);
              }}
              className={control}
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            {!reduce && (
              <button
                type="button"
                aria-label={autoplay ? r.controls.pause : r.controls.play}
                aria-pressed={autoplay}
                onClick={() => {
                  if (atEnd) setIndex(0);
                  setPlaying(!autoplay);
                }}
                className={cn(
                  control,
                  'size-12 border-border-brand bg-brand-primary/10 text-brand-soft',
                )}
              >
                {autoplay ? (
                  <Pause className="size-5" aria-hidden />
                ) : (
                  <Play className="size-5" aria-hidden />
                )}
              </button>
            )}
            <button
              type="button"
              aria-label={r.controls.next}
              disabled={atEnd}
              onClick={() => {
                setIndex((i) => Math.min(total - 1, i + 1));
                setPlaying(false);
              }}
              className={control}
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>
          <div
            aria-live="polite"
            data-replay-step={step.id}
            className="min-w-0 lg:max-w-[60%] lg:text-right"
          >
            <p className="text-caption text-text-muted tabular">
              {fill(r.stepOf, { n: current + 1, total })}
            </p>
            <p className="text-body-lg font-semibold text-text-primary">
              {c.common.steps[step.id].title}
            </p>
            <p className="text-label text-text-secondary">{c.common.steps[step.id].detail}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-caption text-text-muted lg:justify-end">
              <span>{laneName(step.actor)}</span>
              {step.record && <span className="tabular">· {RECORDS[step.record]}</span>}
              <StatusBadge status={step.status} />
            </p>
          </div>
        </div>
        {reduce && <p className="mt-4 text-caption text-text-muted">{r.reduced}</p>}
      </div>
      <p className="mt-4 flex items-start gap-2 text-caption text-text-muted">
        <GitBranch aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-glow" />
        {r.optional}
      </p>
    </Section>
  );
}

/* 12 — adapt to the organization */
const ADAPT_ICON: Record<Adaptation, LucideIcon> = {
  approval: ShieldCheck,
  departments: Users,
  sequence: ListOrdered,
  notifications: Bell,
  controls: Settings2,
};

export function AdaptChapter() {
  const c = useCopy(WORKFLOW);
  const a = c.adapt;
  const { href } = useLocale();
  return (
    <Section id={CHAPTER.adapt} labelledBy="adapt-title" className="scroll-mt-20">
      <SectionHead id="adapt-title" eyebrow={a.eyebrow} title={a.title} lead={a.lead} />
      <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ADAPTATIONS.map((k) => {
          const Icon = ADAPT_ICON[k];
          return (
            <li
              key={k}
              data-adapt={k}
              className="rounded-2xl border border-border-soft bg-surface-base/60 p-5"
            >
              <Icon aria-hidden className="size-5 text-brand-glow" />
              <p className="mt-3 text-label font-semibold text-text-primary">{a.items[k].title}</p>
              <p className="mt-1 text-caption text-text-secondary">{a.items[k].body}</p>
            </li>
          );
        })}
      </ul>
      <div className="mt-10 rounded-[1.75rem] border border-border-soft bg-surface-base/60 p-5 sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <h3 className="text-body-lg font-semibold text-text-primary">{a.packagesTitle}</h3>
          <p className="text-caption text-text-muted">{a.note}</p>
        </div>
        <ol
          className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
          data-adapt-packages
        >
          {PLANS.map((p) => (
            <li key={p.id}>
              <Link
                to={href(`/pricing?plan=${p.id}#packages`)}
                className="group flex min-h-11 flex-col rounded-xl border border-border-soft px-4 py-3 transition-colors hover:border-border-brand"
              >
                <span className="text-caption text-text-muted">{a.packages[p.id]}</span>
                <span className="mt-0.5 inline-flex items-center gap-1.5 text-label font-semibold text-text-primary">
                  {p.name}
                  <ArrowRight
                    className="size-3.5 text-brand-glow transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <Link
          to={href('/pricing')}
          className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-label text-brand-soft hover:text-text-primary"
        >
          {a.pricing}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </Section>
  );
}

export function HowCta() {
  const c = useCopy(WORKFLOW);
  const { href } = useLocale();
  return (
    <Section labelledBy="how-cta" className="pb-24 sm:pb-32">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border-soft bg-[radial-gradient(ellipse_70%_90%_at_50%_0%,rgb(25_195_154/0.14),transparent_70%)] px-6 py-12 text-center sm:px-12">
        <h2 id="how-cta" className="mx-auto max-w-2xl text-h2 text-text-primary">
          {c.cta.title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-body text-text-secondary">{c.cta.lead}</p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link to={href('/demo')} data-cta="try-demo" className={buttonClasses('primary', 'lg')}>
            {c.cta.tryIt}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link to={href('/contact?interest=demo')} className={buttonClasses('secondary', 'lg')}>
            {c.cta.demo}
          </Link>
          <Link to={href('/pricing')} className={buttonClasses('secondary', 'lg')}>
            {c.cta.pricing}
          </Link>
        </div>
        <Link
          to={href('/departments')}
          className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-label text-text-secondary hover:text-text-primary"
        >
          {c.cta.departments}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </Section>
  );
}
