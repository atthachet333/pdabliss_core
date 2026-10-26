import {
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardList,
  Inbox,
  PackageOpen,
  PauseCircle,
} from 'lucide-react';
import { useRef } from 'react';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useLoopRegion } from '@/motion/useLoopRegion';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import { Reveal, RevealItem } from '@/motion/Reveal';
import {
  ConnectedDepartments,
  DeptCta,
  DeptHero,
  DeptPage,
  FlowIO,
  ManagerLens,
  ProductPreview,
  Section,
  SectionHead,
  TodayBoard,
} from '../ui';
import { OPERATIONS } from './copy';

/* Work streams (viewBox 600×300): four team lanes over five days. */
const BARS: {
  lane: number;
  from: number;
  to: number;
  done: number;
  late?: boolean;
  handoff?: boolean;
}[] = [
  { lane: 0, from: 0.1, to: 2.2, done: 1 },
  { lane: 0, from: 2.5, to: 4.4, done: 0.45, handoff: true },
  { lane: 1, from: 0.6, to: 3.0, done: 0.7 },
  { lane: 2, from: 0.2, to: 1.6, done: 1 },
  { lane: 2, from: 1.9, to: 4.6, done: 0.2, late: true },
  { lane: 3, from: 1.2, to: 2.8, done: 0.8 },
  { lane: 3, from: 3.1, to: 4.8, done: 0 },
];

function WorkStreams() {
  const c = useCopy(OPERATIONS);
  const reduce = usePrefersReducedMotion();
  const root = useRef<HTMLElement>(null);
  // The hero's loops (SMIL / CSS) hold still once it is scrolled away.
  useLoopRegion(root);
  const x0 = 120;
  const day = 92;
  const laneY = (i: number) => 56 + i * 54;
  return (
    <figure ref={root} aria-label={c.hero.visual} className="relative mx-auto w-full max-w-[40rem]">
      <svg aria-hidden viewBox="0 0 600 300" className="w-full">
        {c.hero.days.map((d, i) => (
          <g key={d}>
            <line
              x1={x0 + i * day}
              y1="30"
              x2={x0 + i * day}
              y2="276"
              stroke="var(--color-text-muted)"
              strokeOpacity="0.15"
            />
            <text
              x={x0 + i * day + day / 2}
              y="22"
              textAnchor="middle"
              fontSize="11"
              fill="var(--color-text-muted)"
            >
              {d}
            </text>
          </g>
        ))}
        {c.hero.lanes.map((l, i) => (
          <g key={l}>
            <rect
              x="8"
              y={laneY(i) - 18}
              width="584"
              height="36"
              rx="10"
              fill="var(--color-surface-base)"
              fillOpacity="0.5"
            />
            <text x="16" y={laneY(i) + 4} fontSize="11" fill="var(--color-text-secondary)">
              {l}
            </text>
          </g>
        ))}
        {BARS.map((b, i) => {
          const x = x0 + b.from * day;
          const w = (b.to - b.from) * day;
          const y = laneY(b.lane) - 11;
          const color = b.late ? 'var(--color-warning)' : 'var(--color-ws-operations)';
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={w}
                height="22"
                rx="11"
                fill={color}
                fillOpacity="0.18"
                stroke={color}
                strokeOpacity="0.55"
              />
              <rect
                x={x}
                y={y}
                width={Math.max(0, w * b.done)}
                height="22"
                rx="11"
                fill={color}
                fillOpacity="0.55"
              />
              {b.late && (
                <text
                  x={x + w - 8}
                  y={y + 15}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--color-warning)"
                >
                  {c.hero.late}
                </text>
              )}
              {b.handoff && (
                <g>
                  <path
                    d={`M ${x + w + 4} ${y + 11} L ${x + w + 30} ${y + 11}`}
                    stroke="var(--color-ws-warehouse)"
                    strokeWidth="1.5"
                  />
                  <path
                    d={`M ${x + w + 26} ${y + 7} L ${x + w + 31} ${y + 11} L ${x + w + 26} ${y + 15}`}
                    fill="none"
                    stroke="var(--color-ws-warehouse)"
                    strokeWidth="1.5"
                  />
                </g>
              )}
            </g>
          );
        })}
        {/* The “now” line moves across the week. */}
        <g>
          <line
            x1="0"
            y1="30"
            x2="0"
            y2="280"
            stroke="var(--color-brand-glow)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          >
            {!reduce && (
              <animate
                attributeName="x1"
                values={`${x0};${x0 + day * 5}`}
                dur="16s"
                repeatCount="indefinite"
              />
            )}
            {!reduce && (
              <animate
                attributeName="x2"
                values={`${x0};${x0 + day * 5}`}
                dur="16s"
                repeatCount="indefinite"
              />
            )}
          </line>
          {reduce && (
            <line
              x1={x0 + day * 2.4}
              y1="30"
              x2={x0 + day * 2.4}
              y2="280"
              stroke="var(--color-brand-glow)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          )}
        </g>
      </svg>
      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-caption text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-ws-warehouse" aria-hidden />
          {c.hero.handoff}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-warning/60" aria-hidden />
          {c.hero.late}
        </span>
      </p>
    </figure>
  );
}

function Intake() {
  const c = useCopy(OPERATIONS);
  return (
    <Section labelledBy="ops-intake">
      <SectionHead
        id="ops-intake"
        eyebrow={c.intake.eyebrow}
        title={c.intake.title}
        lead={c.intake.lead}
      />
      <Reveal className="mt-10 grid items-center gap-4 lg:grid-cols-[1fr_auto_1.1fr]">
        <ul className="space-y-2">
          {c.intake.sources.map((s) => (
            <li
              key={s.name}
              className="rounded-panel border border-border-soft bg-surface-base/70 px-4 py-3"
            >
              <p className="text-label font-medium text-text-primary">{s.name}</p>
              <p className="text-caption text-text-secondary">{s.note}</p>
            </li>
          ))}
        </ul>
        <ArrowRight
          className="mx-auto size-6 rotate-90 text-[var(--dept)] lg:rotate-0"
          aria-hidden
        />
        <div className="rounded-card border border-[color-mix(in_oklab,var(--dept)_45%,transparent)] bg-panel p-4">
          <p className="flex items-center gap-2 text-label font-semibold text-fg-primary">
            <Inbox className="size-4 text-[var(--dept)]" aria-hidden />
            {c.intake.queue}
          </p>
          <ol className="mt-3 space-y-1.5">
            {c.intake.queueItems.map((q, i) => (
              <li
                key={q}
                className="flex items-center gap-3 rounded-lg border border-line bg-panel-raised px-3 py-2 text-caption text-fg-secondary"
              >
                <span className="text-fg-muted tabular">{i + 1}</span>
                {q}
              </li>
            ))}
          </ol>
        </div>
      </Reveal>
    </Section>
  );
}

/* Assignment grid: which block sits on which team, which day. */
const PLAN: (number | null)[][] = [
  [0, 0, 1, 1, null],
  [3, null, 2, 2, 2],
  [1, 1, 1, 3, 0],
];

function Planning() {
  const c = useCopy(OPERATIONS);
  return (
    <Section labelledBy="ops-plan">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
        <SectionHead
          id="ops-plan"
          eyebrow={c.planning.eyebrow}
          title={c.planning.title}
          lead={c.planning.lead}
        />
        <Reveal className="overflow-hidden rounded-card border border-border-soft">
          <table className="w-full table-fixed text-caption">
            <thead className="bg-surface-raised">
              <tr>
                <th
                  scope="col"
                  className="w-20 px-3 py-2 text-left font-medium text-text-muted sm:w-24"
                >
                  <span className="sr-only">{c.planning.team}</span>
                </th>
                {c.planning.days.map((d) => (
                  <th key={d} scope="col" className="px-1 py-2 font-medium text-text-secondary">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN.map((row, ri) => (
                <tr key={ri} className="border-t border-border-soft">
                  <th scope="row" className="px-3 py-2 text-left font-medium text-text-primary">
                    {c.planning.teams[ri]}
                  </th>
                  {row.map((b, di) => (
                    <td key={di} className="p-1">
                      {b === null ? (
                        <span className="block h-9 rounded-md border border-dashed border-border-soft" />
                      ) : (
                        <span
                          className={cn(
                            'flex h-9 items-center justify-center truncate rounded-md px-1 text-[0.6875rem] text-text-primary',
                            ri === 2
                              ? 'bg-[color-mix(in_oklab,var(--dept)_32%,transparent)]'
                              : 'bg-[color-mix(in_oklab,var(--dept)_16%,transparent)]',
                          )}
                        >
                          {c.planning.blocks[b]}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border-soft px-3 py-2 text-caption text-text-muted">
            {c.planning.teams[2]} · {c.planning.full}
          </p>
        </Reveal>
      </div>
    </Section>
  );
}

function WorkOrderAnatomy() {
  const c = useCopy(OPERATIONS);
  const w = c.workOrder;
  return (
    <Section labelledBy="ops-wo">
      <SectionHead id="ops-wo" eyebrow={w.eyebrow} title={w.title} lead={w.lead} />
      <Reveal className="mt-10 grid gap-4 rounded-card border border-line bg-panel p-5 sm:p-6 lg:grid-cols-[1fr_1.2fr_1fr]">
        <div>
          <p className="flex items-center gap-2 text-label font-semibold text-fg-primary">
            <ClipboardList className="size-4 text-[var(--dept)]" aria-hidden />
            {w.sample}
          </p>
          <dl className="mt-4 space-y-2.5">
            {w.fields.map((f) => (
              <div
                key={f.label}
                className="flex justify-between gap-4 border-b border-line pb-2 text-caption"
              >
                <dt className="text-fg-muted">{f.label}</dt>
                <dd className="text-fg-primary">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <p className="text-caption text-fg-muted">{w.stepsLabel}</p>
          <ol className="mt-3 space-y-2">
            {w.steps.map((s) => (
              <li key={s.name} className="flex items-center gap-2.5 text-label">
                {s.done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                ) : (
                  <Circle className="size-4 shrink-0 text-fg-muted" aria-hidden />
                )}
                <span className={s.done ? 'text-fg-primary' : 'text-fg-secondary'}>{s.name}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <p className="text-caption text-fg-muted">{w.materials}</p>
          <ul className="mt-3 space-y-2">
            {w.materialItems.map((m) => (
              <li
                key={m.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel-raised px-3 py-2 text-caption"
              >
                <span className="text-fg-primary">{m.name}</span>
                <span
                  className={cn(
                    'flex items-center gap-1.5',
                    m.ok ? 'text-success' : 'text-warning',
                  )}
                >
                  {m.ok ? (
                    <CheckCircle2 className="size-3.5" aria-hidden />
                  ) : (
                    <PauseCircle className="size-3.5" aria-hidden />
                  )}
                  {m.state}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </Section>
  );
}

function Progress() {
  const c = useCopy(OPERATIONS);
  return (
    <Section labelledBy="ops-progress">
      <SectionHead
        id="ops-progress"
        eyebrow={c.progress.eyebrow}
        title={c.progress.title}
        lead={c.progress.lead}
      />
      <Reveal stagger className="mt-10 space-y-3">
        {c.progress.items.map((it) => {
          const late = it.tone === 'blocked';
          const done = it.tone === 'done';
          return (
            <RevealItem
              key={it.name}
              className="grid gap-3 rounded-panel border border-line bg-panel p-4 sm:grid-cols-[12rem_1fr_16rem] sm:items-center"
            >
              <p className="text-label font-medium text-fg-primary">{it.name}</p>
              <div className="h-2.5 overflow-hidden rounded-full bg-fill-muted" role="presentation">
                <div
                  className={cn(
                    'h-full rounded-full',
                    late ? 'bg-warning' : done ? 'bg-success' : 'bg-[var(--dept)]',
                  )}
                  style={{ width: `${it.pct}%` }}
                />
              </div>
              <p
                className={cn(
                  'flex items-center gap-1.5 text-caption',
                  late ? 'text-warning' : done ? 'text-success' : 'text-fg-secondary',
                )}
              >
                {late ? (
                  <PauseCircle className="size-3.5 shrink-0" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                )}
                <span className="tabular">{it.pct}%</span> · {it.state}
              </p>
            </RevealItem>
          );
        })}
      </Reveal>
    </Section>
  );
}

function Handoff() {
  const c = useCopy(OPERATIONS);
  const h = c.handoff;
  return (
    <Section labelledBy="ops-handoff">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <SectionHead id="ops-handoff" eyebrow={h.eyebrow} title={h.title} lead={h.lead} />
        <Reveal className="rounded-card border border-border-soft bg-surface-base/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-[color-mix(in_oklab,var(--dept)_55%,transparent)] px-3 py-1.5 text-label text-text-primary">
              {h.from}
            </span>
            <span
              aria-hidden
              className="h-px flex-1 bg-gradient-to-r from-[var(--dept)] to-ws-warehouse"
            />
            <span className="flex items-center gap-1.5 rounded-full border border-ws-warehouse/60 px-3 py-1.5 text-label text-text-primary">
              <PackageOpen className="size-4 text-ws-warehouse" aria-hidden />
              {h.to}
            </span>
          </div>
          <ul className="mt-5 space-y-2">
            {h.checks.map((ch) => (
              <li key={ch} className="flex items-center gap-2.5 text-label text-text-secondary">
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                {ch}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}

export default function OperationsPage() {
  const c = useCopy(OPERATIONS);
  usePageMeta(c.meta.title, c.meta.description);
  return (
    <DeptPage id="operations">
      <DeptHero
        dept="operations"
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        lead={c.hero.lead}
        visual={<WorkStreams />}
      />
      <Intake />
      <TodayBoard id="ops-today" copy={c.today} />
      <Planning />
      <WorkOrderAnatomy />
      <Progress />
      <Handoff />
      <FlowIO id="ops-io" copy={c.io} layout="ledger" />
      <ManagerLens id="ops-manager" copy={c.manager} />
      <ProductPreview
        id="ops-preview"
        dept="operations"
        title={c.preview.title}
        lead={c.preview.lead}
      />
      <ConnectedDepartments id="ops-connected" dept="operations" copy={c.connections} />
      <DeptCta id="ops-cta" dept="operations" />
    </DeptPage>
  );
}
