import {
  ArrowRight,
  Check,
  EyeOff,
  FileText,
  Lock,
  MessagesSquare,
  Phone,
  Sheet,
  Files,
} from 'lucide-react';
import { lazy, Suspense, useRef, useState } from 'react';
import { Link } from 'react-router';
import { tabKeys } from '@/features/departments/tabs';
import { Section, SectionHead } from '@/features/departments/ui';
import { Segmented } from '@/components/ui/Segmented';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { WORKFLOW } from './copy';
import {
  buildRoute,
  CHAPTER,
  DEFAULT_DECISIONS,
  HANDOFF_PARTS,
  HIDDEN,
  RECORDS,
  STEPS,
  VISIBLE,
  type Lane,
} from './model';
import { laneColor, useLaneName } from './state';
import { LaneChip, RouteStack, StatusBadge } from './visuals';

const WorldPreview = lazy(() => import('@/features/landing/home/previews'));

/* 01 — the problem: scattered work, then one route */
export function ProblemChapter() {
  const c = useCopy(WORKFLOW);
  const p = c.problem;
  const laneName = useLaneName();
  const icons = [MessagesSquare, Phone, Sheet, Files];
  // Scattered positions for the fragments (percent of the panel).
  const spots = [
    [8, 12, -6],
    [56, 6, 4],
    [30, 40, -3],
    [64, 46, 6],
    [10, 70, 3],
    [48, 78, -5],
    [72, 22, -2],
  ] as const;
  const lanes: Lane[] = ['sales', 'warehouse', 'operations', 'purchasing', 'accounting'];
  return (
    <Section id={CHAPTER.problem} labelledBy="problem-title" className="scroll-mt-20">
      <SectionHead id="problem-title" eyebrow={p.eyebrow} title={p.title} lead={p.lead} />
      <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <figure className="relative overflow-hidden rounded-[1.75rem] border border-border-soft bg-surface-base/60 p-6">
          <figcaption className="text-label font-semibold text-text-secondary">
            {p.before}
          </figcaption>
          <div className="relative mt-4 h-72">
            <svg
              aria-hidden
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full"
            >
              <path
                d="M 15 20 C 60 0, 20 60, 70 55 S 20 90, 60 85 M 70 25 C 40 40, 90 70, 20 75"
                fill="none"
                stroke="var(--color-border-strong)"
                strokeWidth="0.4"
                strokeDasharray="1.5 2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <ul>
              {p.fragments.map((f, i) => {
                const [x, y, r] = spots[i % spots.length]!;
                const Icon = icons[i];
                const question = !Icon;
                return (
                  <li
                    key={f}
                    style={{ left: `${x}%`, top: `${y}%`, transform: `rotate(${r}deg)` }}
                    className={cn(
                      'absolute inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-caption whitespace-nowrap',
                      question
                        ? 'border-warning/40 bg-warning/[0.06] text-warning'
                        : 'border-border-soft bg-surface-raised text-text-secondary',
                    )}
                  >
                    {Icon ? <Icon aria-hidden className="size-3.5" /> : <span aria-hidden>?</span>}
                    {f}
                  </li>
                );
              })}
            </ul>
          </div>
        </figure>
        <figure className="relative overflow-hidden rounded-[1.75rem] border border-border-brand/50 bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,rgb(25_195_154/0.1),transparent_70%)] p-6">
          <figcaption className="text-label font-semibold text-text-primary">{p.after}</figcaption>
          <ol className="relative mt-6 space-y-3">
            <span
              aria-hidden
              className="absolute top-2 bottom-2 left-[0.6875rem] w-0.5 rounded-full bg-gradient-to-b from-brand-glow/80 to-brand-glow/20"
            />
            {lanes.map((lane) => (
              <li key={lane} className="relative flex items-center gap-3">
                <span
                  aria-hidden
                  className="relative z-10 size-6 rounded-full border-2 bg-surface-base"
                  style={{ borderColor: laneColor(lane) }}
                />
                <span className="text-label text-text-primary">{laneName(lane)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-label text-text-secondary">{p.afterBody}</p>
        </figure>
      </div>
    </Section>
  );
}

/* 02 — work enters CORE once */
export function EntersChapter() {
  const c = useCopy(WORKFLOW);
  const e = c.enters;
  const k = e.card;
  const rows = [
    { label: k.owner, value: k.ownerValue },
    { label: k.status, value: k.statusValue },
    { label: k.next, value: k.nextValue },
    { label: k.dependency, value: k.dependencyValue },
  ];
  const lenses: Lane[] = ['sales', 'warehouse', 'operations', 'purchasing', 'accounting'];
  return (
    <Section id={CHAPTER.enters} labelledBy="enters-title" className="scroll-mt-20">
      <div className="grid grid-cols-1 gap-12">
        <SectionHead id="enters-title" eyebrow={e.eyebrow} title={e.title} lead={e.lead} />
        <figure aria-label={e.title.replace('\n', ' ')} className="relative">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface-base px-4 py-3 sm:w-40 sm:flex-col sm:items-start">
              <FileText aria-hidden className="size-5 text-[var(--color-ws-sales)]" />
              <div>
                <p className="text-label font-medium text-text-primary">{e.from}</p>
                <p className="text-caption text-text-muted tabular">{RECORDS.customerPo}</p>
              </div>
            </div>
            <div
              aria-hidden
              className="flex items-center justify-center gap-2 text-caption text-brand-glow sm:flex-col"
            >
              <ArrowRight className="size-4 rotate-90 sm:rotate-0" />
              <span>{e.into}</span>
            </div>
            <div
              data-work-card
              className="flex-1 rounded-2xl border border-border-brand/60 bg-surface-raised p-5 shadow-[0_24px_60px_-34px_rgb(25_195_154/0.55)]"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-body font-semibold text-text-primary">
                  {k.title} <span className="text-text-muted tabular">{RECORDS.salesOrder}</span>
                </p>
                <StatusBadge status="waiting" />
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {rows.map((r) => (
                  <div key={r.label} className="border-t border-border-soft pt-2.5">
                    <dt className="text-caption text-text-muted">{r.label}</dt>
                    <dd className="text-label text-text-primary">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          {/* Each department receives its own lens on the same record */}
          <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lenses.map((lane) => (
              <li
                key={lane}
                className="rounded-xl border border-border-soft bg-surface-base/70 px-3.5 py-2.5"
              >
                <span className="flex items-center gap-2 text-caption font-medium text-text-primary">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: laneColor(lane) }}
                  />
                  <LaneName lane={lane} />
                </span>
                <span className="mt-0.5 block text-caption text-text-muted">
                  {VISIBLE[lane]
                    .slice(0, 3)
                    .map((f) => c.common.fields[f])
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </figure>
      </div>
    </Section>
  );
}

function LaneName({ lane }: { lane: Lane }) {
  return <>{useLaneName()(lane)}</>;
}

/* 03 — responsibility routing & information boundaries */
const ROUTING_LANES: Lane[] = [
  'sales',
  'operations',
  'warehouse',
  'purchasing',
  'accounting',
  'executive',
];

export function RoutingChapter() {
  const c = useCopy(WORKFLOW);
  const r = c.routing;
  const laneName = useLaneName();
  const { href } = useLocale();
  const [active, setActive] = useState(2); // Warehouse first: the strongest boundary.
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const lane = ROUTING_LANES[active]!;
  const acts = STEPS.filter((s) => s.actor === lane);
  return (
    <Section id={CHAPTER.routing} labelledBy="routing-title" className="scroll-mt-20">
      <SectionHead id="routing-title" eyebrow={r.eyebrow} title={r.title} lead={r.lead} />
      <div
        role="tablist"
        aria-label={r.tabs}
        onKeyDown={(e) => tabKeys(ROUTING_LANES.length, active, setActive, tabs)(e)}
        className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
      >
        {ROUTING_LANES.map((l, i) => {
          const on = i === active;
          return (
            <button
              key={l}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`routing-tab-${l}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="routing-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-label transition-colors duration-200',
                on
                  ? 'border-border-brand bg-surface-raised text-text-primary'
                  : 'border-border-soft text-text-secondary hover:border-border-strong',
              )}
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: laneColor(l) }}
              />
              <span className="truncate">{laneName(l)}</span>
              {on && <Check aria-hidden className="ml-auto size-4 shrink-0 text-brand-glow" />}
            </button>
          );
        })}
      </div>

      <div
        id="routing-panel"
        role="tabpanel"
        aria-labelledby={`routing-tab-${lane}`}
        data-routing-lane={lane}
        className="mt-4 grid grid-cols-1 gap-6 rounded-[1.75rem] border border-border-soft bg-surface-base/60 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      >
        <div>
          <p className="text-caption font-semibold text-text-muted">{r.sees}</p>
          <ul className="mt-2 flex flex-wrap gap-2" data-visible-fields>
            {VISIBLE[lane].map((f) => (
              <li
                key={f}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-brand/50 bg-surface-raised px-2.5 py-1.5 text-label text-text-primary"
              >
                <Check aria-hidden className="size-3.5 text-brand-glow" />
                {c.common.fields[f]}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-caption font-semibold text-text-muted">{r.hidden}</p>
          <ul className="mt-2 flex flex-wrap gap-2" data-hidden-fields>
            {HIDDEN[lane].map((f) => (
              <li
                key={f}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-2.5 py-1.5 text-label text-text-muted"
              >
                <EyeOff aria-hidden className="size-3.5" />
                {c.common.fields[f]}
              </li>
            ))}
          </ul>
          {lane === 'warehouse' && (
            <p
              data-warehouse-principle
              className="mt-5 flex items-start gap-2 rounded-xl border border-border-brand/50 bg-brand-primary/[0.06] px-3.5 py-3 text-label text-text-primary"
            >
              <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-glow" />
              {r.principle}
            </p>
          )}
          {acts.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-1.5">
              {acts.map((s) => (
                <li
                  key={s.id}
                  className="rounded-full border border-border-soft px-2.5 py-1 text-caption text-text-secondary"
                >
                  {c.common.steps[s.id].title}
                </li>
              ))}
            </ul>
          )}
          <Link
            to={href(`/departments/${lane}`)}
            className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-label text-brand-soft hover:text-text-primary"
          >
            {c.common.openDept}: {laneName(lane)}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <figure className="min-w-0">
          <div
            inert
            aria-hidden
            className="pointer-events-none overflow-hidden rounded-2xl border border-border-soft bg-surface-base"
          >
            <Suspense fallback={<div className="h-64 animate-pulse bg-surface-raised/50" />}>
              <WorldPreview id={lane as Exclude<Lane, 'supplier'>} />
            </Suspense>
          </div>
          <figcaption className="mt-2 text-caption text-text-muted">{r.preview}</figcaption>
        </figure>
      </div>
    </Section>
  );
}

/* 04 — a handoff carries the work, not just a message */
export function HandoffChapter() {
  const c = useCopy(WORKFLOW);
  const h = c.handoff;
  const [answer, setAnswer] = useState<'available' | 'shortage'>('shortage');
  const steps = buildRoute({
    ...DEFAULT_DECISIONS,
    stockEnough: answer === 'available',
  }).steps.slice(0, answer === 'available' ? 6 : 7);
  return (
    <Section id={CHAPTER.handoff} labelledBy="handoff-title" className="scroll-mt-20">
      <SectionHead id="handoff-title" eyebrow={h.eyebrow} title={h.title} lead={h.lead} />
      <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* The handoff packet */}
        <figure aria-label={h.title.replace('\n', ' ')} className="relative">
          <div className="flex items-center justify-between gap-3">
            <LaneChip lane="sales" />
            <span
              aria-hidden
              className="h-px flex-1 bg-gradient-to-r from-[var(--color-ws-sales)] to-[var(--color-ws-warehouse)]"
            />
            <LaneChip lane="warehouse" />
          </div>
          <dl
            data-handoff-packet
            className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border-soft bg-border-soft sm:grid-cols-2"
          >
            {HANDOFF_PARTS.map((part) => (
              <div key={part} data-part={part} className="bg-surface-base px-4 py-3">
                <dt className="text-caption text-text-muted">{h.parts[part].label}</dt>
                <dd className="mt-0.5 text-label text-text-primary">{h.parts[part].value}</dd>
              </div>
            ))}
          </dl>
        </figure>
        {/* The question, and how CORE routes the answer */}
        <div className="rounded-[1.75rem] border border-border-soft bg-surface-base/60 p-5 sm:p-7">
          <p id="handoff-q" className="text-body-lg font-semibold text-text-primary">
            {h.question}
          </p>
          <p className="mt-1 text-caption text-text-muted">{h.answers}</p>
          <Segmented
            labelledBy="handoff-q"
            value={answer}
            onChange={setAnswer}
            options={[
              { value: 'available', label: h.available },
              { value: 'shortage', label: h.shortage },
            ]}
            className="mt-4 grid w-full grid-cols-2"
          />
          <p
            aria-live="polite"
            data-handoff-result={answer}
            className="mt-4 text-label text-text-secondary"
          >
            {h.results[answer]}
          </p>
          <div className="mt-5">
            <RouteStack steps={steps} label={h.results[answer]} />
          </div>
        </div>
      </div>
    </Section>
  );
}
