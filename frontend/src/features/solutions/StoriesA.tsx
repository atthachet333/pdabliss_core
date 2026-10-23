import {
  ArrowRight,
  BellRing,
  Check,
  CircleHelp,
  History,
  Lock,
  MessageCircle,
  Pause,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useDepartments } from '@/config/departments';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { SOLUTIONS_COPY } from './copy';
import {
  APPROVAL_KINDS,
  APPROVAL_STAGES,
  getSolution,
  LENSES,
  LIFECYCLE,
  MISTAKES,
  type ApprovalKind,
  type Lens,
  type MistakeId,
  type SolutionId,
} from './model';
import { Chapter, ChapterTitle, Facts, Frame, Kicker, MetaStrip, Plane, ToneBadge } from './parts';

const titleId = (id: SolutionId) => `${getSolution(id).anchor}-title`;

/* ------------------------------------------------------------------ */
/* 03 — Work falling through · asymmetric / editorial                   */
/* ------------------------------------------------------------------ */

function FallingTrack() {
  const c = useCopy(SOLUTIONS_COPY);
  const f = c.falling;
  const departments = useDepartments();
  const owners = (['warehouse', 'warehouse', 'accounting'] as const).map(
    (d) => departments.find((x) => x.id === d)!.name,
  );
  const [view, setView] = useState<'before' | 'after'>('before');
  const after = view === 'after';
  const tones = ['blocked', 'waiting', 'attention'] as const;
  return (
    <Plane tone={after ? 'clear' : 'warm'} className="lg:p-10">
      <Segmented<'before' | 'after'>
        label={c.map.view}
        value={view}
        onChange={setView}
        options={[
          { value: 'before', label: c.common.before },
          { value: 'after', label: c.common.after },
        ]}
        className="grid w-full grid-cols-2 sm:w-72"
      />
      <ol className="mt-8 space-y-6" data-falling={view}>
        {f.items.map((item, i) => (
          <li
            key={item.code}
            className="grid grid-cols-1 gap-2 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-center sm:gap-5"
          >
            <span className="text-label font-semibold text-text-primary tabular">{item.code}</span>
            <div>
              <div className="relative h-7">
                <span
                  aria-hidden
                  className="absolute top-1/2 right-0 left-0 h-px bg-border-strong"
                />
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-1/2 left-[36%] h-6 w-[28%] -translate-y-1/2 rounded-md border border-dashed transition-colors duration-500',
                    after ? 'border-transparent' : 'border-warning/50 bg-warning/[0.05]',
                  )}
                />
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-surface-base transition-[left,border-color] duration-700 ease-out',
                    after ? 'left-[90%] border-brand-glow' : 'left-1/2 border-warning',
                  )}
                >
                  {after ? (
                    <Check className="size-3.5 text-brand-glow" />
                  ) : (
                    <CircleHelp className="size-3.5 text-warning" />
                  )}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <span className="text-caption text-text-muted">{item.at}</span>
                {after ? (
                  <ToneBadge tone="resolved" label={`${f.card.owner}: ${owners[i]}`} />
                ) : (
                  <ToneBadge tone={tones[i]!} label={f.gap} />
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {after && (
        <dl
          data-owner-card
          className="mt-8 grid grid-cols-1 gap-x-8 gap-y-4 border-t border-border-brand/30 pt-6 sm:grid-cols-2"
        >
          {(
            [
              [f.card.owner, f.card.ownerValue],
              [f.card.state, f.card.stateValue],
              [f.card.next, f.card.nextValue],
              [f.card.waiting, f.card.waitingValue],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-caption text-text-muted">{k}</dt>
              <dd className="text-label text-text-primary">{v}</dd>
            </div>
          ))}
          <div className="sm:col-span-2">
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
      )}
    </Plane>
  );
}

export function FallingThroughStory() {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories.fallingThrough;
  const f = c.falling;
  return (
    <Chapter
      id={getSolution('fallingThrough').anchor}
      labelledBy={titleId('fallingThrough')}
      space="lg"
      data={{ solution: 'fallingThrough' }}
    >
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <div className="lg:pt-6">
            <Kicker>{st.eyebrow}</Kicker>
            <ChapterTitle id={titleId('fallingThrough')} size="statement" className="mt-5">
              {st.title}
            </ChapterTitle>
            <p className="mt-8 text-h3 text-brand-soft">{c.anchors.owner}</p>
            <Facts id="fallingThrough" variant="prose" className="mt-8 max-w-xl" />
          </div>
          <FallingTrack />
        </div>
        {/* Real situations, set editorially — one leads, two follow */}
        <div className="mt-20 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
          <Kicker tone="muted" className="lg:col-span-3">
            {f.situationsTitle}
          </Kicker>
          {f.situations.map((s, i) => (
            <p
              key={s}
              className={cn(
                'border-l pl-5',
                i === 0
                  ? 'border-warning/60 text-h3 text-text-primary'
                  : 'border-border-strong text-body text-text-secondary',
              )}
            >
              “{s}”
            </p>
          ))}
        </div>
        <MetaStrip id="fallingThrough" className="mt-20" />
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 04 — Status chasing · true split-screen                              */
/* ------------------------------------------------------------------ */

// Where the questions scatter on wide screens (percent of the left half).
const SCATTER = [
  [6, 10, -4],
  [44, 4, 3],
  [16, 40, 2],
  [52, 52, -3],
  [10, 74, -2],
] as const;

export function StatusChasingStory() {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories.statusChasing;
  const k = c.chasing;
  const departments = useDepartments();
  const [lens, setLens] = useState<Lens>('sales');
  return (
    <Chapter
      id={getSolution('statusChasing').anchor}
      labelledBy={titleId('statusChasing')}
      plane="navy"
      space="lg"
      data={{ solution: 'statusChasing' }}
    >
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <Kicker>{st.eyebrow}</Kicker>
            <ChapterTitle id={titleId('statusChasing')} size="statement" className="mt-5">
              {st.title}
            </ChapterTitle>
          </div>
          <Facts id="statusChasing" className="lg:pb-2" />
        </div>
      </Frame>
      <Frame width="full" className="mt-14 lg:mt-20">
        <div className="grid grid-cols-1 overflow-hidden rounded-[2rem] lg:grid-cols-2">
          {/* Asking around: scattered, fragmented */}
          <div className="relative bg-surface-dark/70 bg-[radial-gradient(ellipse_90%_80%_at_30%_30%,rgb(245_184_75/0.08),transparent_70%)] p-8 sm:p-12 lg:min-h-[30rem]">
            <p className="text-h3 text-warning">{c.anchors.asking}</p>
            <ul
              className="mt-8 flex flex-wrap gap-3 lg:absolute lg:inset-x-12 lg:top-28 lg:bottom-12 lg:mt-0 lg:block"
              data-questions
            >
              {k.questions.map((q, i) => {
                const [x, y, r] = SCATTER[i % SCATTER.length]!;
                return (
                  <li
                    key={q}
                    style={{
                      ['--x' as string]: `${x}%`,
                      ['--y' as string]: `${y}%`,
                      ['--r' as string]: `${r}deg`,
                    }}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-2xl bg-surface-raised/90 px-4 py-2.5 text-label text-text-secondary shadow-[0_12px_30px_-18px_rgb(0_0_0/0.9)] lg:absolute lg:top-[var(--y)] lg:left-[var(--x)] lg:rotate-[var(--r)]',
                      i % 2 ? 'rounded-bl-sm' : 'rounded-br-sm',
                    )}
                  >
                    <MessageCircle aria-hidden className="size-4 text-text-muted" />
                    {q}
                  </li>
                );
              })}
            </ul>
          </div>
          {/* With CORE: one shared state, seen by role */}
          <div className="bg-surface-base/80 bg-[radial-gradient(ellipse_90%_80%_at_70%_20%,rgb(25_195_154/0.12),transparent_70%)] p-8 sm:p-12">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-h3 text-brand-soft">{c.map.after}</p>
              <p className="text-caption text-text-muted">
                {k.itemTitle} · <span className="tabular">SO-1042</span>
              </p>
            </div>
            <p className="mt-6">
              <ToneBadge
                tone="waiting"
                label={k.sharedState}
                className="text-body-lg font-semibold"
              />
            </p>
            <p id="chasing-lens" className="sr-only">
              {k.lensesLabel}
            </p>
            <Segmented<Lens>
              labelledBy="chasing-lens"
              size="sm"
              value={lens}
              onChange={setLens}
              options={LENSES.map((l) => ({
                value: l,
                label: departments.find((d) => d.id === l)!.name,
              }))}
              className="mt-8 grid w-full grid-cols-2 sm:grid-cols-5"
            />
            <div className="mt-6" data-lens={lens}>
              <span className="sr-only">{k.sharedState}</span>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
                {k.lenses[lens].map(([label, value]) => (
                  <div key={label} className="border-t border-border-brand/25 pt-3">
                    <dt className="text-caption text-text-muted">{label}</dt>
                    <dd className="mt-0.5 text-label text-text-primary">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="mt-8 text-caption text-text-muted">{k.boundary}</p>
          </div>
        </div>
      </Frame>
      <Frame width="wide">
        <MetaStrip id="statusChasing" variant="quiet" className="mt-16" />
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 05 — Human error · immersive inspection layer                        */
/* ------------------------------------------------------------------ */

const PRINCIPLE_ICON: Record<'prevent' | 'detect' | 'alert' | 'control' | 'trace', LucideIcon> = {
  prevent: ShieldCheck,
  detect: ScanSearch,
  alert: BellRing,
  control: Lock,
  trace: History,
};

function PrincipleAnchor({
  p,
  active,
  align,
}: {
  p: keyof typeof PRINCIPLE_ICON;
  active: boolean;
  align: 'left' | 'right';
}) {
  const c = useCopy(SOLUTIONS_COPY);
  const Icon = PRINCIPLE_ICON[p];
  return (
    <div
      data-principle-anchor={p}
      data-active={active}
      className={cn(
        'relative flex items-center gap-4 py-5 transition-opacity duration-500',
        align === 'right' && 'lg:flex-row-reverse lg:text-right',
        active ? 'opacity-100' : 'opacity-35',
      )}
    >
      <Icon
        aria-hidden
        className={cn('size-5 shrink-0 sm:size-7', active ? 'text-brand-glow' : 'text-text-muted')}
      />
      <div>
        <p
          className={cn(
            'text-[1.0625rem] leading-none font-semibold tracking-[0.08em] sm:text-[1.5rem] sm:tracking-[0.12em]',
            active ? 'text-text-primary' : 'text-text-muted',
          )}
        >
          {p.toUpperCase()}
        </p>
        <p className="mt-1.5 text-label text-text-secondary">{c.humanError.principles[p]}</p>
      </div>
      {/* A light line toward the scenario when this principle acts */}
      <span
        aria-hidden
        className={cn(
          'absolute top-1/2 hidden h-px w-10 lg:block',
          align === 'left' ? '-right-12 bg-gradient-to-r' : '-left-12 bg-gradient-to-l',
          active ? 'from-transparent to-brand-glow' : 'from-transparent to-transparent',
        )}
      />
    </div>
  );
}

export function HumanErrorStory() {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories.humanError;
  const h = c.humanError;
  const [id, setId] = useState<MistakeId>('wrongQty');
  const m = h.mistakes[id];
  const principle = MISTAKES.find((x) => x.id === id)!.principle;
  const values = [m.mistake, m.check, m.action, m.trace];
  const stageIcon = [CircleHelp, ScanSearch, PRINCIPLE_ICON[principle], History];
  return (
    <Chapter
      id={getSolution('humanError').anchor}
      labelledBy={titleId('humanError')}
      plane="deep"
      space="lg"
      data={{ solution: 'humanError' }}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_45%_at_50%_58%,rgb(25_195_154/0.08),transparent_70%)]"
      />
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
          <div>
            <Kicker>{st.eyebrow}</Kicker>
            <ChapterTitle id={titleId('humanError')} size="statement" className="mt-5">
              {st.title}
            </ChapterTitle>
          </div>
          <div>
            <p className="text-caption font-semibold text-brand-soft">{c.anchors.inspection}</p>
            <Facts id="humanError" variant="prose" className="mt-4" />
          </div>
        </div>
        <p id="error-choose" className="mt-16 text-caption font-semibold text-text-muted">
          {h.choose}
        </p>
        <Segmented<MistakeId>
          labelledBy="error-choose"
          size="sm"
          value={id}
          onChange={setId}
          options={MISTAKES.map((x) => ({ value: x.id, label: h.mistakes[x.id].title }))}
          className="mt-3 grid w-full grid-cols-2 lg:grid-cols-6"
        />
        {/* The inspection layer: principles as structural anchors around the scenario */}
        <div className="mt-14 grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
          <div className="order-2 grid grid-cols-2 gap-x-6 lg:order-1 lg:grid-cols-1">
            <PrincipleAnchor p="prevent" active={principle === 'prevent'} align="left" />
            <PrincipleAnchor p="detect" active={principle === 'detect'} align="left" />
          </div>
          <div
            data-lifecycle={id}
            className="order-1 rounded-[2rem] bg-surface-base/70 bg-[radial-gradient(ellipse_90%_70%_at_50%_0%,rgb(25_195_154/0.12),transparent_70%)] p-6 shadow-[0_40px_120px_-60px_rgb(25_195_154/0.45)] sm:p-9 lg:order-2"
          >
            <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-brand-soft">
              {principle.toUpperCase()} · {h.principles[principle]}
            </span>
            <ol className="relative mt-6 space-y-6">
              <span
                aria-hidden
                className="absolute top-3 bottom-3 left-[0.9375rem] w-px bg-gradient-to-b from-warning/60 via-border-strong to-brand-glow/70"
              />
              {LIFECYCLE.map((stage, i) => {
                const Icon = stageIcon[i]!;
                return (
                  <li key={stage} data-stage={stage} className="relative flex gap-4">
                    <span
                      className={cn(
                        'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-dark',
                        i === 0
                          ? 'text-warning'
                          : i === 1
                            ? 'text-text-secondary'
                            : 'text-brand-glow',
                      )}
                    >
                      <Icon aria-hidden className="size-4" />
                    </span>
                    <div>
                      <p className="text-caption text-text-muted">
                        <span className="tabular">{String(i + 1).padStart(2, '0')}</span> ·{' '}
                        {h.stages[stage]}
                      </p>
                      <p
                        className={cn(
                          'mt-1 text-body',
                          i === 0 ? 'text-text-secondary' : 'text-text-primary',
                        )}
                      >
                        {values[i]}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="order-3 grid grid-cols-2 gap-x-6 lg:grid-cols-1">
            <PrincipleAnchor p="alert" active={principle === 'alert'} align="right" />
            <PrincipleAnchor p="control" active={principle === 'control'} align="right" />
          </div>
        </div>
        {/* TRACE runs underneath everything — the history layer */}
        <div className="mx-auto mt-8 flex max-w-xl flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-brand-glow/25 pt-6">
          <History aria-hidden className="size-6 text-brand-glow" />
          <p className="text-[1.0625rem] leading-none font-semibold tracking-[0.08em] text-text-primary sm:text-[1.5rem] sm:tracking-[0.12em]">
            TRACE
          </p>
          <p className="text-label text-text-secondary">{h.principles.trace}</p>
        </div>
        <MetaStrip id="humanError" variant="split" className="mt-20" />
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 06 — Approval bottleneck · horizontal process stage                  */
/* ------------------------------------------------------------------ */

export function ApprovalStory() {
  const c = useCopy(SOLUTIONS_COPY);
  const st = c.stories.approval;
  const a = c.approval;
  const [kind, setKind] = useState<ApprovalKind>('payment');
  const [decided, setDecided] = useState(false);
  const k = a.kinds[kind];
  const detail: Partial<Record<(typeof APPROVAL_STAGES)[number], string>> = {
    request: k.name,
    rule: k.rule,
    approver: k.approver,
  };
  const waitAt = APPROVAL_STAGES.indexOf('waiting');
  return (
    <Chapter
      id={getSolution('approval').anchor}
      labelledBy={titleId('approval')}
      space="lg"
      data={{ solution: 'approval' }}
    >
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
          <div>
            <Kicker>{st.eyebrow}</Kicker>
            <ChapterTitle id={titleId('approval')} className="mt-5">
              {st.title}
            </ChapterTitle>
            <Facts id="approval" variant="prose" className="mt-6 max-w-2xl" />
          </div>
          <div className="space-y-4 lg:justify-self-end">
            <div>
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
              className={buttonClasses(decided ? 'secondary' : 'primary', 'md')}
            >
              {decided ? (
                <RotateCcw className="size-4" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              {decided ? a.reset : a.decide}
            </button>
          </div>
        </div>
      </Frame>
      {/* The stage: open nodes on one line; "waiting" opens a deliberate gap */}
      <Frame width="full" className="mt-16 lg:mt-24">
        <ol
          className="relative flex flex-col lg:flex-row lg:items-stretch"
          data-approval-flow={decided ? 'continued' : 'waiting'}
        >
          {APPROVAL_STAGES.map((stage, i) => {
            const paused = !decided && i === waitAt;
            const done = i < waitAt || decided;
            const ahead = !decided && i > waitAt;
            return (
              <li
                key={stage}
                data-stage={stage}
                data-state={paused ? 'waiting' : ahead ? 'ahead' : 'done'}
                className={cn(
                  'relative flex gap-4 pb-8 transition-opacity duration-500 lg:flex-col lg:gap-0 lg:pb-0',
                  stage === 'waiting' ? 'lg:flex-[2.4]' : 'lg:flex-1',
                  ahead && 'opacity-45',
                )}
              >
                {/* line + node */}
                <div className="relative flex w-8 shrink-0 justify-center lg:h-8 lg:w-full lg:justify-start">
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 lg:top-1/2 lg:right-0 lg:bottom-auto lg:left-0 lg:h-px lg:w-full lg:translate-x-0',
                      paused
                        ? 'bg-[repeating-linear-gradient(to_bottom,var(--color-info)_0_6px,transparent_6px_12px)] lg:bg-[repeating-linear-gradient(to_right,var(--color-info)_0_6px,transparent_6px_12px)]'
                        : done
                          ? 'bg-brand-glow/60'
                          : 'bg-border-strong',
                    )}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'relative z-10 flex size-8 items-center justify-center rounded-full bg-surface-dark ring-2',
                      paused ? 'ring-info' : done ? 'ring-brand-glow' : 'ring-border-strong',
                    )}
                  >
                    {paused ? (
                      <Pause className="size-3.5 text-info" />
                    ) : done ? (
                      <Check className="size-3.5 text-brand-glow" />
                    ) : null}
                  </span>
                </div>
                <div className={cn('lg:mt-5 lg:pr-6', paused && 'lg:pr-10')}>
                  <p className="text-caption text-text-muted tabular">
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <p
                    className={cn(
                      'mt-0.5 font-semibold text-text-primary',
                      paused ? 'text-h3' : 'text-body',
                    )}
                  >
                    {a.stages[stage]}
                  </p>
                  {detail[stage] && (
                    <p className="mt-1 text-label text-text-secondary">{detail[stage]}</p>
                  )}
                  {paused && (
                    <>
                      <p className="mt-3 flex items-center gap-1.5 text-label font-medium text-info">
                        <Pause aria-hidden className="size-4" />
                        {a.pause}
                      </p>
                      <p className="mt-1 text-label text-text-secondary">{a.elapsed}</p>
                    </>
                  )}
                  {done && stage !== 'waiting' && <ToneBadge tone="resolved" className="mt-2" />}
                </div>
              </li>
            );
          })}
        </ol>
        <p aria-live="polite" className="mt-10 text-body text-text-secondary">
          {decided ? a.continued : `${a.pause} — ${k.approver}`}
        </p>
        <p className="mt-2 text-caption text-text-muted">{a.note}</p>
      </Frame>
      <Frame width="wide">
        <MetaStrip id="approval" className="mt-16" />
      </Frame>
    </Chapter>
  );
}
