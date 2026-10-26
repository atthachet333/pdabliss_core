import { AlertTriangle, CheckCircle2, ChevronRight, CircleDot, PauseCircle } from 'lucide-react';
import { useRef, useState, type CSSProperties } from 'react';
import { useDepartments } from '@/config/departments';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useLoopRegion } from '@/motion/useLoopRegion';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import { Reveal, RevealItem } from '@/motion/Reveal';
import { DEPT_ACCENT, type DeptKey } from '../catalog';
import { tabKeys } from '../tabs';
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
import { EXECUTIVE } from './copy';

const SOURCES: DeptKey[] = ['sales', 'operations', 'warehouse', 'purchasing', 'accounting'];

const SIGNAL_TONE = {
  attention: { icon: AlertTriangle, className: 'text-warning' },
  blocked: { icon: PauseCircle, className: 'text-danger' },
  calm: { icon: CircleDot, className: 'text-info' },
} as const;

/** Hero: department signals rise and converge on one calm command surface. */
function SignalsConverge() {
  const c = useCopy(EXECUTIVE);
  const all = useDepartments();
  const reduce = usePrefersReducedMotion();
  const root = useRef<HTMLElement>(null);
  // The hero's loops (SMIL / CSS) hold still once it is scrolled away.
  useLoopRegion(root);
  const nodes = SOURCES.map((id, i) => ({ id, x: 60 + i * 110, y: 360 }));
  const target = { x: 280, y: 150 };
  return (
    <figure ref={root} aria-label={c.hero.visual} className="relative mx-auto w-full max-w-[38rem]">
      <svg aria-hidden viewBox="0 0 560 420" className="w-full">
        <defs>
          <linearGradient id="exec-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-brand-glow)" stopOpacity="0.08" />
            <stop offset="1" stopColor="var(--color-brand-glow)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M 20 330 Q 280 270 540 330"
          fill="none"
          stroke="var(--color-text-muted)"
          strokeOpacity="0.25"
          strokeDasharray="2 6"
        />
        <rect x="0" y="0" width="560" height="260" fill="url(#exec-sky)" />
        {nodes.map((n, i) => {
          const d = `M ${n.x} ${n.y - 16} C ${n.x} ${n.y - 120}, ${target.x} ${target.y + 150}, ${target.x} ${target.y + 70}`;
          return (
            <g key={n.id}>
              <path
                d={d}
                fill="none"
                stroke={DEPT_ACCENT[n.id]}
                strokeOpacity="0.45"
                strokeWidth="1.4"
              />
              {!reduce && (
                <circle r="3" fill={DEPT_ACCENT[n.id]}>
                  <animateMotion dur={`${3.2 + i * 0.5}s`} repeatCount="indefinite" path={d} />
                </circle>
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r="15"
                fill="var(--color-surface-base)"
                stroke={DEPT_ACCENT[n.id]}
                strokeOpacity="0.8"
              />
              <circle cx={n.x} cy={n.y} r="4" fill={DEPT_ACCENT[n.id]} />
              <text
                x={n.x}
                y={n.y + 36}
                textAnchor="middle"
                fontSize="13"
                fill="var(--color-text-secondary)"
              >
                {all.find((d) => d.id === n.id)?.name}
              </text>
            </g>
          );
        })}
      </svg>
      {/* The command surface — real text, localized. */}
      <div className="absolute top-[4%] left-1/2 w-[78%] -translate-x-1/2 rounded-2xl border border-border-strong bg-surface-raised/95 p-3 shadow-[0_30px_70px_-30px_rgb(0_0_0/0.9)] sm:p-4">
        <p className="flex items-center gap-2 text-caption font-semibold text-text-primary">
          <span className="size-1.5 rounded-full bg-brand-glow shadow-glow-sm" aria-hidden />
          {c.hero.surface}
        </p>
        <ul className="mt-2 space-y-1.5">
          {c.hero.signals.map((s) => {
            const t = SIGNAL_TONE[s.tone as keyof typeof SIGNAL_TONE];
            const Icon = t.icon;
            return (
              <li
                key={s.text}
                className="flex items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[0.75rem] sm:text-caption"
              >
                <Icon className={cn('size-3.5 shrink-0', t.className)} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-fg-primary">{s.text}</span>
                <span className="hidden shrink-0 text-fg-muted sm:inline">{s.from}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </figure>
  );
}

function Visibility() {
  const c = useCopy(EXECUTIVE);
  return (
    <Section labelledBy="exec-visibility">
      <SectionHead id="exec-visibility" eyebrow={c.visibility.eyebrow} title={c.visibility.title} />
      <Reveal
        stagger
        className="mt-12 grid gap-px overflow-hidden rounded-card border border-border-soft bg-border-soft sm:grid-cols-2 lg:grid-cols-4"
      >
        {c.visibility.steps.map((s, i) => (
          <RevealItem key={s.title} className="bg-surface-base p-6">
            <p className="text-caption text-text-muted tabular">0{i + 1}</p>
            <h3 className="mt-2 text-h3 text-text-primary">{s.title}</h3>
            <p className="mt-2 text-label text-text-secondary">{s.body}</p>
          </RevealItem>
        ))}
      </Reveal>
    </Section>
  );
}

const HEALTH = {
  ok: { icon: CheckCircle2, className: 'text-success', bar: 'bg-success' },
  watch: { icon: AlertTriangle, className: 'text-warning', bar: 'bg-warning' },
  stuck: { icon: PauseCircle, className: 'text-danger', bar: 'bg-danger' },
} as const;

function Pulse() {
  const c = useCopy(EXECUTIVE);
  const all = useDepartments();
  return (
    <Section labelledBy="exec-pulse">
      <SectionHead
        id="exec-pulse"
        eyebrow={c.pulse.eyebrow}
        title={c.pulse.title}
        lead={c.pulse.lead}
      />
      <Reveal stagger className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {c.pulse.rows.map((r) => {
          const h = HEALTH[r.health];
          const Icon = h.icon;
          const d = all.find((x) => x.id === r.dept)!;
          return (
            <RevealItem
              key={r.dept}
              style={{ '--a': DEPT_ACCENT[r.dept as DeptKey] } as CSSProperties}
              className="relative overflow-hidden rounded-panel border border-line bg-panel p-4"
            >
              <span aria-hidden className={cn('absolute inset-x-0 top-0 h-0.5', h.bar)} />
              <p className="flex items-center gap-2 text-label font-medium text-fg-primary">
                <d.icon className="size-4 text-[var(--a)]" aria-hidden />
                {d.name}
              </p>
              <p
                className={cn(
                  'mt-3 flex items-center gap-1.5 text-caption font-semibold',
                  h.className,
                )}
              >
                <Icon className="size-4" aria-hidden />
                {c.pulse.status[r.health]}
              </p>
              <p className="mt-1 text-caption text-fg-secondary">{r.signal}</p>
            </RevealItem>
          );
        })}
      </Reveal>
    </Section>
  );
}

/** Many quiet dots, a few raised: the exception filter. */
function Exceptions() {
  const c = useCopy(EXECUTIVE);
  const raised = new Set([7, 22, 31]);
  return (
    <Section labelledBy="exec-exceptions">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <SectionHead
          id="exec-exceptions"
          eyebrow={c.exceptions.eyebrow}
          title={c.exceptions.title}
          lead={c.exceptions.lead}
        />
        <figure
          aria-hidden
          className="rounded-card border border-border-soft bg-surface-base/60 p-6"
        >
          <div className="grid grid-cols-10 gap-2.5">
            {Array.from({ length: 40 }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'aspect-square rounded-full',
                  raised.has(i)
                    ? 'scale-125 bg-warning shadow-[0_0_14px_rgb(245_184_75/0.6)]'
                    : 'bg-text-muted/20',
                )}
              />
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-caption text-text-secondary">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-text-muted/30" />
              {c.exceptions.normal}
            </span>
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-3.5 text-warning" />
              {c.exceptions.exception}
            </span>
          </div>
        </figure>
      </div>
    </Section>
  );
}

function DrillDown() {
  const c = useCopy(EXECUTIVE);
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const item = c.drill.items[active]!;
  return (
    <Section labelledBy="exec-drill">
      <SectionHead
        id="exec-drill"
        eyebrow={c.drill.eyebrow}
        title={c.drill.title}
        lead={c.drill.lead}
      />
      <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)]">
        <div
          role="tablist"
          aria-label={c.drill.tabs}
          aria-orientation="vertical"
          onKeyDown={(e) => tabKeys(c.drill.items.length, active, setActive, tabs)(e)}
          className="flex flex-col gap-2"
        >
          {c.drill.items.map((it, i) => (
            <button
              key={it.label}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`drill-tab-${i}`}
              aria-selected={i === active}
              aria-controls="drill-panel"
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              className={cn(
                'flex min-h-12 items-center gap-2 rounded-xl border px-4 text-left text-label transition-colors',
                i === active
                  ? 'border-warning/40 bg-warning/[0.07] text-text-primary'
                  : 'border-border-soft text-text-secondary hover:border-border-strong',
              )}
            >
              <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
              {it.label}
            </button>
          ))}
        </div>
        <div
          id="drill-panel"
          role="tabpanel"
          aria-labelledby={`drill-tab-${active}`}
          className="rounded-card border border-border-soft bg-surface-base/70 p-5 sm:p-6"
        >
          <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {item.path.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span
                  className={cn(
                    'rounded-lg border px-3 py-2 text-caption',
                    i === item.path.length - 1
                      ? 'border-border-brand bg-brand-primary/10 text-text-primary'
                      : 'border-line bg-panel text-fg-secondary',
                  )}
                  style={{ marginInlineStart: `${i * 0.75}rem` }}
                >
                  {step}
                </span>
                {i < item.path.length - 1 && (
                  <ChevronRight className="hidden size-4 text-text-muted sm:block" aria-hidden />
                )}
              </li>
            ))}
          </ol>
          <p className="mt-5 flex items-center gap-2 border-t border-border-soft pt-4 text-label text-text-primary">
            <CheckCircle2 className="size-4 shrink-0 text-brand-glow" aria-hidden />
            {item.action}
          </p>
        </div>
      </div>
    </Section>
  );
}

export default function ExecutivePage() {
  const c = useCopy(EXECUTIVE);
  usePageMeta(c.meta.title, c.meta.description);
  return (
    <DeptPage id="executive">
      <DeptHero
        dept="executive"
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        lead={c.hero.lead}
        visual={<SignalsConverge />}
      />
      <Visibility />
      <TodayBoard id="exec-today" copy={c.today} layout="lanes" />
      <Pulse />
      <Exceptions />
      <DrillDown />
      <ManagerLens id="exec-manager" copy={c.manager} labels={c.levels} />
      <FlowIO id="exec-io" copy={c.io} layout="ledger" />
      <ProductPreview
        id="exec-preview"
        dept="executive"
        title={c.preview.title}
        lead={c.preview.lead}
      />
      <ConnectedDepartments id="exec-connected" dept="executive" copy={c.connections} />
      <DeptCta id="exec-cta" dept="executive" />
    </DeptPage>
  );
}
