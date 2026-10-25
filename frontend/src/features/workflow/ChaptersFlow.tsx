import {
  BellRing,
  Check,
  CircleDashed,
  FileWarning,
  History,
  Hourglass,
  Lock,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState } from 'react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Section, SectionHead } from '@/features/departments/ui';
import { Segmented } from '@/components/ui/Segmented';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { fill } from '@/lib/fill';
import { WORKFLOW } from './copy';
import {
  actorsIn,
  APPROVAL_CHAIN,
  APPROVAL_PAUSE,
  APPROVAL_TYPES,
  buildRoute,
  CHAPTER,
  DECISION_IDS,
  DEFAULT_DECISIONS,
  EXCEPTIONS,
  isDecisionRelevant,
  PRINCIPLES,
  RECEIVING_SAMPLE,
  RECORDS,
  SAFEGUARDS,
  type DecisionId,
  type ExceptionId,
  type Principle,
} from './model';
import { useLaneName, useWorkflow } from './state';
import { LaneChip, RouteView, StatusBadge, StatusLegend } from './visuals';

/* 05 — decision points: the visitor chooses, the route changes */
function DecisionRow({ id }: { id: DecisionId }) {
  const c = useCopy(WORKFLOW);
  const { decisions, setDecision } = useWorkflow();
  const labelId = useId();
  const d = c.common.decisions[id];
  const relevant = isDecisionRelevant(id, decisions);
  return (
    <div
      data-decision={id}
      data-relevant={relevant}
      className={cn(
        'flex flex-col justify-between gap-3 rounded-2xl border border-border-soft bg-surface-base/60 p-4',
        !relevant && 'opacity-55',
      )}
    >
      <p id={labelId} className="text-label text-text-primary">
        {d.q}
      </p>
      {relevant ? (
        <Segmented<'yes' | 'no'>
          labelledBy={labelId}
          size="sm"
          value={decisions[id] ? 'yes' : 'no'}
          onChange={(v) => setDecision(id, v === 'yes')}
          options={[
            { value: 'yes', label: d.yes },
            { value: 'no', label: d.no },
          ]}
          className="grid w-full grid-cols-2"
        />
      ) : (
        <span className="flex min-h-11 items-center text-caption text-text-muted">
          {c.decisions.notRelevant}
        </span>
      )}
    </div>
  );
}

export function DecisionsChapter() {
  const c = useCopy(WORKFLOW);
  const k = c.decisions;
  const { decisions, reset } = useWorkflow();
  const route = buildRoute(decisions);
  return (
    <Section id={CHAPTER.decisions} labelledBy="decisions-title" className="scroll-mt-20">
      <SectionHead id="decisions-title" eyebrow={k.eyebrow} title={k.title} lead={k.lead} />
      <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DECISION_IDS.map((id) => (
          <DecisionRow key={id} id={id} />
        ))}
      </div>
      <button
        type="button"
        onClick={reset}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong px-4 text-label text-text-secondary hover:text-text-primary"
      >
        <RotateCcw className="size-4" aria-hidden />
        {k.reset}
      </button>
      <div
        className="mt-6 min-w-0 rounded-[1.75rem] border border-border-soft bg-surface-base/60 p-4 sm:p-6"
        aria-live="polite"
      >
        <p className="text-caption text-text-muted">
          {c.common.example} · {k.route}
        </p>
        <RouteView steps={route.steps} label={k.route} className="mt-4" />
        {route.pausedAt && (
          <p data-paused={route.pausedAt} className="mt-4 text-label text-warning">
            {k.paused}: {c.common.steps[route.pausedAt].title}
          </p>
        )}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="text-caption font-semibold text-text-muted">{k.involved}</p>
            <ul className="mt-2 flex flex-wrap gap-2" data-involved>
              {actorsIn(route).map((a) => (
                <li key={a} data-actor={a}>
                  <LaneChip lane={a} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-caption font-semibold text-text-muted">{k.skipped}</p>
            {route.skipped.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5" data-skipped>
                {route.skipped.map((s) => (
                  <li
                    key={s}
                    data-skipped-step={s}
                    className="rounded-full border border-dashed border-border-strong px-2.5 py-1 text-caption text-text-muted line-through decoration-text-muted/60"
                  >
                    {c.common.steps[s].title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-caption text-text-secondary">{k.noneSkipped}</p>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* 06 — approval is part of the work */
export function ApprovalChapter() {
  const c = useCopy(WORKFLOW);
  const a = c.approval;
  const [approved, setApproved] = useState(false);
  const pauseAt = APPROVAL_CHAIN.indexOf(APPROVAL_PAUSE);
  return (
    <Section id={CHAPTER.approval} labelledBy="approval-title" className="scroll-mt-20">
      <SectionHead id="approval-title" eyebrow={a.eyebrow} title={a.title} lead={a.lead} />
      <div className="mt-12 rounded-[1.75rem] border border-border-soft bg-surface-base/60 p-5 sm:p-8">
        <ol className="grid grid-cols-1 gap-3 lg:grid-cols-6 lg:gap-2" data-approval-chain>
          {APPROVAL_CHAIN.map((stage, i) => {
            const done = i < pauseAt || (approved && i >= pauseAt);
            const waiting = !approved && i === pauseAt;
            const ahead = !approved && i > pauseAt;
            const status = waiting ? 'waiting' : ahead ? 'normal' : 'complete';
            return (
              <li
                key={stage}
                data-stage={stage}
                data-state={status}
                className={cn(
                  'relative rounded-2xl border p-4 transition-[opacity,border-color] duration-500',
                  waiting
                    ? 'border-info/60 bg-info/[0.06]'
                    : done
                      ? 'border-border-brand/50 bg-surface-raised'
                      : // EP19: stages not reached yet read as dashed and quieter, with a label —
                        // not faded below readable contrast.
                        'border-dashed border-border-soft',
                )}
              >
                <span className="text-caption text-text-muted tabular">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p
                  className={cn(
                    'mt-1 text-label font-semibold',
                    ahead ? 'text-text-secondary' : 'text-text-primary',
                  )}
                >
                  {a.stages[stage].title}
                </p>
                <p className="mt-1 text-caption text-text-secondary">{a.stages[stage].body}</p>
                {ahead ? (
                  <span
                    data-not-yet
                    className="mt-2 inline-flex items-center gap-1 text-caption text-text-muted"
                  >
                    <CircleDashed aria-hidden className="size-3.5 shrink-0" />
                    {a.notYet}
                  </span>
                ) : (
                  <StatusBadge status={status === 'normal' ? 'waiting' : status} className="mt-2" />
                )}
                {waiting && (
                  <span className="mt-2 flex items-center gap-1.5 text-caption font-medium text-info">
                    <Hourglass aria-hidden className="size-3.5" />
                    {a.waiting}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {approved ? (
            <button
              type="button"
              onClick={() => setApproved(false)}
              className={buttonClasses('secondary', 'md')}
            >
              <RotateCcw className="size-4" aria-hidden />
              {a.reset}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setApproved(true)}
              className={buttonClasses('primary', 'md')}
            >
              <Check className="size-4" aria-hidden />
              {a.approve}
            </button>
          )}
          <p aria-live="polite" className="text-label text-text-secondary">
            {approved ? a.continued : a.waiting}
          </p>
        </div>
      </div>
      <h3 className="mt-10 text-body-lg font-semibold text-text-primary">{a.typesTitle}</h3>
      <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {APPROVAL_TYPES.map((t, i) => (
          <li
            key={t}
            data-approval-type={t}
            className="rounded-2xl border border-border-soft bg-surface-base/60 p-5"
          >
            {/* A small diagram of the path: one approver, several in sequence, or a fork */}
            <svg aria-hidden viewBox="0 0 120 28" className="h-7 w-28">
              <line x1="6" y1="14" x2="114" y2="14" stroke="var(--color-border-strong)" />
              {i === 0 && <circle cx="60" cy="14" r="6" fill="var(--color-brand-glow)" />}
              {i === 1 &&
                [36, 60, 84].map((x) => (
                  <circle key={x} cx={x} cy="14" r="5" fill="var(--color-brand-glow)" />
                ))}
              {i === 2 && (
                <>
                  <path
                    d="M 40 14 C 55 14, 55 5, 72 5 M 40 14 C 55 14, 55 23, 72 23"
                    fill="none"
                    stroke="var(--color-brand-glow)"
                  />
                  <circle cx="40" cy="14" r="4" fill="var(--color-brand-glow)" />
                  <circle cx="76" cy="5" r="4" fill="var(--color-brand-glow)" />
                  <circle cx="76" cy="23" r="4" fill="none" stroke="var(--color-brand-glow)" />
                </>
              )}
            </svg>
            <p className="mt-3 text-label font-semibold text-text-primary">{a.types[t].name}</p>
            <p className="mt-1 text-caption text-text-secondary">{a.types[t].body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-caption text-text-muted">{a.concept}</p>
    </Section>
  );
}

/* 07 — exceptions rise out of a calm route */
export function ExceptionsChapter() {
  const c = useCopy(WORKFLOW);
  const x = c.exceptions;
  const laneName = useLaneName();
  const [selected, setSelected] = useState<ExceptionId | 'none'>('supplierLate');
  // The calm baseline: the default route with every step running normally.
  const calm = buildRoute(DEFAULT_DECISIONS).steps.map((s) => ({
    ...s,
    status: s.status === 'complete' ? s.status : ('normal' as const),
  }));
  const ex = EXCEPTIONS.find((e) => e.id === selected) ?? null;
  return (
    <Section id={CHAPTER.exceptions} labelledBy="exceptions-title" className="scroll-mt-20">
      <SectionHead id="exceptions-title" eyebrow={x.eyebrow} title={x.title} lead={x.lead} />
      <p id="exceptions-choose" className="mt-10 text-caption font-semibold text-text-muted">
        {x.choose}
      </p>
      <Segmented<ExceptionId | 'none'>
        labelledBy="exceptions-choose"
        size="sm"
        value={selected}
        onChange={setSelected}
        options={[
          { value: 'none', label: x.none },
          ...EXCEPTIONS.map((e) => ({ value: e.id, label: x.items[e.id].title })),
        ]}
        className="mt-2 grid w-full grid-cols-2 sm:grid-cols-4"
      />
      <div className="mt-6 grid grid-cols-1 gap-4">
        <div className="min-w-0 rounded-[1.75rem] border border-border-soft bg-surface-base/60 p-4 sm:p-6">
          <RouteView
            steps={calm}
            raised={ex ? { step: ex.step, status: ex.status } : null}
            collapse
            label={ex ? x.items[ex.id].body : x.calm}
          />
          <StatusLegend className="mt-5" />
        </div>
        <div
          aria-live="polite"
          data-exception={selected}
          className="rounded-[1.75rem] border border-border-soft bg-surface-raised/50 p-5 sm:p-6"
        >
          {ex ? (
            <>
              <StatusBadge status={ex.status} />
              <p className="mt-2 text-body-lg font-semibold text-text-primary">
                {x.items[ex.id].title}
              </p>
              <p className="mt-1 text-label text-text-secondary">{x.items[ex.id].body}</p>
              <p className="mt-4 text-caption text-text-muted">
                {c.common.step}: {c.common.steps[ex.step].title}
              </p>
              <p className="mt-3 text-caption text-text-muted">{x.raisedTo}</p>
              <p className="mt-1 text-label font-medium text-text-primary">{laneName(ex.owner)}</p>
              <p className="mt-3 text-label text-text-secondary">→ {x.items[ex.id].action}</p>
            </>
          ) : (
            <p className="text-label text-text-secondary">{x.calm}</p>
          )}
        </div>
      </div>
    </Section>
  );
}

/* 08 — the five human-error principles on the real route */
const PRINCIPLE_ICON: Record<Principle, LucideIcon> = {
  prevent: ShieldCheck,
  detect: ScanSearch,
  alert: BellRing,
  control: Lock,
  trace: History,
};

function SafeguardVisual({ p }: { p: Principle }) {
  const c = useCopy(WORKFLOW);
  const h = c.humanError;
  const f = c.common.fields;
  if (p === 'prevent')
    return (
      <dl className="grid grid-cols-2 gap-2 text-caption">
        <div className="rounded-lg border border-border-soft px-2.5 py-1.5">
          <dt className="text-text-muted">{f.lot}</dt>
          <dd className="text-text-primary tabular">{RECORDS.lot}</dd>
        </div>
        <div className="rounded-lg border border-dashed border-warning/60 px-2.5 py-1.5">
          <dt className="text-text-muted">{f.expiry}</dt>
          <dd className="text-warning">—</dd>
        </div>
      </dl>
    );
  if (p === 'detect')
    return (
      <dl className="grid grid-cols-3 gap-2 text-caption" data-detect>
        <div className="rounded-lg border border-border-soft px-2 py-1.5">
          <dt className="text-text-muted">{h.ordered}</dt>
          <dd className="text-text-primary tabular">{RECEIVING_SAMPLE.ordered}</dd>
        </div>
        <div className="rounded-lg border border-border-soft px-2 py-1.5">
          <dt className="text-text-muted">{h.received}</dt>
          <dd className="text-text-primary tabular">{RECEIVING_SAMPLE.received}</dd>
        </div>
        <div className="rounded-lg border border-warning/60 px-2 py-1.5">
          <dt className="text-text-muted">{h.difference}</dt>
          <dd className="text-warning tabular">
            −{RECEIVING_SAMPLE.ordered - RECEIVING_SAMPLE.received}
          </dd>
        </div>
      </dl>
    );
  if (p === 'alert')
    return (
      <p className="flex items-center gap-2 text-caption text-warning">
        <BellRing aria-hidden className="size-4" />
        {RECORDS.purchaseOrder} · {f.expectedReceipt}
      </p>
    );
  if (p === 'control')
    return (
      <p className="flex items-center gap-2 text-caption text-danger">
        <FileWarning aria-hidden className="size-4" />
        {RECORDS.paymentRequest} · {f.documentStatus}
      </p>
    );
  return (
    <p className="flex items-center gap-2 text-caption text-text-secondary tabular">
      <History aria-hidden className="size-4 text-brand-glow" />
      {RECORDS.salesOrder} · 09:42 · 11:05 · 14:20
    </p>
  );
}

export function HumanErrorChapter() {
  const c = useCopy(WORKFLOW);
  const h = c.humanError;
  return (
    <Section id={CHAPTER.humanError} labelledBy="human-error-title" className="scroll-mt-20">
      <SectionHead id="human-error-title" eyebrow={h.eyebrow} title={h.title} lead={h.lead} />
      {/* EP18: one connected sequence along the route — not a 3 + 2 card grid. */}
      <ol data-principles className="relative mt-12">
        <span
          aria-hidden
          className="absolute top-4 bottom-4 left-[1.0625rem] w-px bg-gradient-to-b from-brand-glow/55 via-brand-glow/25 to-brand-glow/5"
        />
        {PRINCIPLES.map((p) => {
          const Icon = PRINCIPLE_ICON[p];
          const item = h.items[p];
          const at = SAFEGUARDS[p];
          return (
            <li
              key={p}
              data-principle={p}
              className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-5 pb-10 last:pb-0 lg:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,24rem)] lg:gap-x-12"
            >
              <span className="relative flex size-9 items-center justify-center rounded-full border border-border-brand/60 bg-surface-dark">
                <Icon aria-hidden className="size-4 text-brand-glow" />
              </span>
              <div className="min-w-0 pt-1">
                <p className="text-caption font-semibold text-brand-soft">
                  {p.toUpperCase()} · {item.name}
                </p>
                <p className="mt-2 text-body font-semibold text-text-primary">{item.title}</p>
                <p className="mt-1.5 max-w-xl text-label text-text-secondary">
                  {fill(item.body, {
                    ordered: RECEIVING_SAMPLE.ordered,
                    received: RECEIVING_SAMPLE.received,
                    diff: RECEIVING_SAMPLE.ordered - RECEIVING_SAMPLE.received,
                  })}
                </p>
              </div>
              <div className="col-start-2 mt-4 min-w-0 lg:col-start-3 lg:mt-1">
                <SafeguardVisual p={p} />
                <p className="mt-3 text-caption text-text-muted">
                  {c.common.step}: {c.common.steps[at.step].title}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
