import {
  ArrowRight,
  Check,
  CircleHelp,
  History,
  MessageCircle,
  Pause,
  RotateCcw,
  ScanSearch,
} from 'lucide-react';
import { useState } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import { useDepartments } from '@/config/departments';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { SOLUTIONS_COPY } from './copy';
import {
  APPROVAL_KINDS,
  APPROVAL_STAGES,
  LENSES,
  LIFECYCLE,
  MISTAKES,
  type ApprovalKind,
  type Lens,
  type MistakeId,
} from './model';
import { Panel, Story, ToneBadge } from './parts';

/* 03 — work falling through: items in the gap, then owned */
function FallingVisual() {
  const c = useCopy(SOLUTIONS_COPY);
  const f = c.falling;
  const [view, setView] = useState<'before' | 'after'>('before');
  const after = view === 'after';
  const tones = ['blocked', 'waiting', 'attention'] as const;
  const departments = useDepartments();
  const owners = (['warehouse', 'warehouse', 'accounting'] as const).map(
    (d) => departments.find((x) => x.id === d)!.name,
  );
  return (
    <Panel tone={after ? 'clear' : 'warm'}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-label font-semibold text-text-primary">{f.principle}</p>
        <Segmented<'before' | 'after'>
          label={c.map.view}
          value={view}
          onChange={setView}
          options={[
            { value: 'before', label: c.common.before },
            { value: 'after', label: c.common.after },
          ]}
          className="grid w-full shrink-0 grid-cols-2 sm:w-64"
        />
      </div>
      {/* Work items on their handoff track */}
      <ol className="mt-6 space-y-4" data-falling={view}>
        {f.items.map((item, i) => (
          <li
            key={item.code}
            className="grid grid-cols-1 gap-2 sm:grid-cols-[7rem_minmax(0,1fr)_9rem] sm:items-center sm:gap-4"
          >
            <span className="text-label font-semibold text-text-primary tabular">{item.code}</span>
            <div>
              <div className="relative h-6">
                <span
                  aria-hidden
                  className="absolute top-1/2 right-0 left-0 h-px bg-border-strong"
                />
                {/* The gap between the two departments */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-1/2 left-[38%] h-5 w-[24%] -translate-y-1/2 rounded-md border border-dashed transition-colors duration-500',
                    after ? 'border-transparent' : 'border-warning/50 bg-warning/[0.05]',
                  )}
                />
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-surface-base transition-[left,border-color] duration-700 ease-out',
                    after ? 'left-[88%] border-brand-glow' : 'left-1/2 border-warning',
                  )}
                >
                  {after ? (
                    <Check className="size-3.5 text-brand-glow" />
                  ) : (
                    <CircleHelp className="size-3.5 text-warning" />
                  )}
                </span>
              </div>
              <p className="mt-1 text-caption text-text-muted">{item.at}</p>
            </div>
            {after ? (
              <ToneBadge tone="resolved" label={`${c.falling.card.owner}: ${owners[i]}`} />
            ) : (
              <ToneBadge tone={tones[i]!} label={f.gap} />
            )}
          </li>
        ))}
      </ol>
      {after ? (
        <dl
          data-owner-card
          className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border-brand/50 bg-border-soft sm:grid-cols-2"
        >
          {(
            [
              [f.card.owner, f.card.ownerValue],
              [f.card.state, f.card.stateValue],
              [f.card.next, f.card.nextValue],
              [f.card.waiting, f.card.waitingValue],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="bg-surface-raised px-4 py-3">
              <dt className="text-caption text-text-muted">{k}</dt>
              <dd className="text-label text-text-primary">{v}</dd>
            </div>
          ))}
          <div className="bg-surface-raised px-4 py-3 sm:col-span-2">
            <dt className="flex items-center gap-1.5 text-caption text-text-muted">
              <History aria-hidden className="size-3.5" />
              {f.card.history}
            </dt>
            <dd>
              <ol className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-label text-text-primary">
                {f.card.historyValue.map((h, i) => (
                  <li key={h} className="flex items-center gap-2">
                    {h}
                    {i < f.card.historyValue.length - 1 && (
                      <ArrowRight aria-hidden className="size-3.5 text-brand-glow" />
                    )}
                  </li>
                ))}
              </ol>
            </dd>
          </div>
        </dl>
      ) : (
        <div className="mt-6">
          <p className="text-caption font-semibold text-text-muted">{f.situationsTitle}</p>
          <ul className="mt-2 space-y-1.5">
            {f.situations.map((s) => (
              <li key={s} className="flex items-start gap-2 text-label text-text-secondary">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

export function FallingThroughStory() {
  return <Story id="fallingThrough" layout="stacked" visual={<FallingVisual />} />;
}

/* 04 — status chasing: questions vs one shared state, seen through each lens */
function ChasingVisual() {
  const c = useCopy(SOLUTIONS_COPY);
  const k = c.chasing;
  const [lens, setLens] = useState<Lens>('sales');
  const departments = useDepartments();
  const lensLabel = (l: Lens) => departments.find((d) => d.id === l)!.name;
  return (
    <div className="grid grid-cols-1 gap-3">
      <Panel tone="warm">
        <p className="text-caption font-semibold text-warning">{c.common.before}</p>
        <ul className="mt-3 flex flex-wrap gap-2" data-questions>
          {k.questions.map((q, i) => (
            <li
              key={q}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-2xl border border-border-soft bg-surface-raised px-3 py-2 text-label text-text-secondary',
                i % 2 ? 'rounded-bl-sm' : 'rounded-br-sm',
              )}
            >
              <MessageCircle aria-hidden className="size-3.5 text-text-muted" />
              {q}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel tone="clear">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-caption font-semibold text-brand-soft">{c.common.after}</p>
          <p className="text-caption text-text-muted">
            {k.itemTitle} · <span className="tabular">SO-1042</span>
          </p>
        </div>
        <p id="chasing-lens" className="sr-only">
          {k.lensesLabel}
        </p>
        <Segmented<Lens>
          labelledBy="chasing-lens"
          size="sm"
          value={lens}
          onChange={setLens}
          options={LENSES.map((l) => ({ value: l, label: lensLabel(l) }))}
          className="mt-3 grid w-full grid-cols-2 sm:grid-cols-5"
        />
        <div
          className="mt-4 rounded-2xl border border-border-soft bg-surface-base p-4"
          data-lens={lens}
        >
          <ToneBadge tone="waiting" label={k.sharedState} />
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {k.lenses[lens].map(([label, value]) => (
              <div key={label}>
                <dt className="text-caption text-text-muted">{label}</dt>
                <dd className="text-label text-text-primary">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="mt-3 text-caption text-text-muted">{k.boundary}</p>
      </Panel>
    </div>
  );
}

export function StatusChasingStory() {
  return <Story id="statusChasing" layout="split" visual={<ChasingVisual />} />;
}

/* 05 — human error: a mistake's lifecycle through CORE's checks */
function ErrorVisual() {
  const c = useCopy(SOLUTIONS_COPY);
  const h = c.humanError;
  const [id, setId] = useState<MistakeId>('wrongQty');
  const m = h.mistakes[id];
  const principle = MISTAKES.find((x) => x.id === id)!.principle;
  const values = [m.mistake, m.check, m.action, m.trace];
  return (
    <div>
      <p id="error-choose" className="text-caption font-semibold text-text-muted">
        {h.choose}
      </p>
      <Segmented<MistakeId>
        labelledBy="error-choose"
        size="sm"
        value={id}
        onChange={setId}
        options={MISTAKES.map((x) => ({ value: x.id, label: h.mistakes[x.id].title }))}
        className="mt-2 grid w-full grid-cols-2 lg:grid-cols-6"
      />
      <ol className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4" data-lifecycle={id}>
        {LIFECYCLE.map((stage, i) => (
          <li
            key={stage}
            data-stage={stage}
            className={cn(
              'relative rounded-2xl border p-5',
              i === 0
                ? 'border-warning/40 bg-[linear-gradient(to_bottom,rgb(245_184_75/0.07),transparent)]'
                : i === 1
                  ? 'border-border-strong bg-surface-base/70'
                  : 'border-border-brand/50 bg-[linear-gradient(to_bottom,rgb(25_195_154/0.08),transparent)]',
            )}
          >
            <span className="flex items-center gap-2 text-caption text-text-muted">
              <span className="tabular">{String(i + 1).padStart(2, '0')}</span>
              {h.stages[stage]}
            </span>
            {i === 2 && (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border-brand px-2.5 py-0.5 text-caption font-semibold text-brand-soft">
                {principle.toUpperCase()} · {h.principles[principle]}
              </span>
            )}
            {i === 1 && <ScanSearch aria-hidden className="mt-2 size-5 text-text-secondary" />}
            {i === 3 && <History aria-hidden className="mt-2 size-5 text-brand-glow" />}
            <p className="mt-2 text-label text-text-primary">{values[i]}</p>
            {i < 3 && (
              <ArrowRight
                aria-hidden
                className="absolute top-1/2 -right-3 z-10 hidden size-5 -translate-y-1/2 rounded-full bg-surface-base text-brand-glow md:block"
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function HumanErrorStory() {
  return <Story id="humanError" layout="stacked" visual={<ErrorVisual />} />;
}

/* 06 — approval bottleneck: the process visibly pauses at one approver */
function ApprovalVisual() {
  const c = useCopy(SOLUTIONS_COPY);
  const a = c.approval;
  const [kind, setKind] = useState<ApprovalKind>('payment');
  const [decided, setDecided] = useState(false);
  const k = a.kinds[kind];
  const detail: Partial<Record<(typeof APPROVAL_STAGES)[number], string>> = {
    request: k.name,
    rule: k.rule,
    approver: k.approver,
    waiting: decided ? undefined : a.elapsed,
  };
  const waitAt = APPROVAL_STAGES.indexOf('waiting');
  return (
    <Panel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full lg:max-w-xl">
          <p id="approval-kind" className="text-caption font-semibold text-text-muted">
            {a.kindsLabel}
          </p>
          <Segmented<ApprovalKind>
            labelledBy="approval-kind"
            size="sm"
            value={kind}
            onChange={(v) => {
              setKind(v);
              setDecided(false);
            }}
            options={APPROVAL_KINDS.map((x) => ({ value: x, label: a.kinds[x].name }))}
            className="mt-2 grid w-full grid-cols-2 sm:grid-cols-4"
          />
        </div>
        <button
          type="button"
          onClick={() => setDecided(!decided)}
          className={buttonClasses(decided ? 'secondary' : 'primary', 'md', 'shrink-0')}
        >
          {decided ? (
            <RotateCcw className="size-4" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          {decided ? a.reset : a.decide}
        </button>
      </div>
      <ol
        className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-6"
        data-approval-flow={decided ? 'continued' : 'waiting'}
      >
        {APPROVAL_STAGES.map((stage, i) => {
          const done = i < waitAt || decided;
          const paused = !decided && i === waitAt;
          const ahead = !decided && i > waitAt;
          return (
            <li
              key={stage}
              data-stage={stage}
              data-state={paused ? 'waiting' : ahead ? 'ahead' : 'done'}
              className={cn(
                'relative rounded-2xl border p-3.5 transition-[opacity,border-color] duration-500',
                paused
                  ? 'border-info/60 bg-info/[0.07]'
                  : done
                    ? 'border-border-brand/50 bg-surface-raised'
                    : 'border-border-soft',
                ahead && 'opacity-50',
              )}
            >
              <span className="text-caption text-text-muted tabular">
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="mt-0.5 text-label font-semibold text-text-primary">{a.stages[stage]}</p>
              {detail[stage] && (
                <p className="mt-1 text-caption text-text-secondary">{detail[stage]}</p>
              )}
              {paused && (
                <span className="mt-2 flex items-center gap-1 text-caption font-medium text-info">
                  <Pause aria-hidden className="size-3.5" />
                  {a.pause}
                </span>
              )}
              {done && <ToneBadge tone="resolved" className="mt-2" />}
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className="mt-4 text-label text-text-secondary">
        {decided ? a.continued : `${a.pause} — ${k.approver}`}
      </p>
      <p className="mt-2 text-caption text-text-muted">{a.note}</p>
    </Panel>
  );
}

export function ApprovalStory() {
  return <Story id="approval" layout="stacked" visual={<ApprovalVisual />} />;
}
