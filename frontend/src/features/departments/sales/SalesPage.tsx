import { motion } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  Circle,
  GitFork,
  MessageSquareText,
  PackageCheck,
  Truck,
} from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useDepartments } from '@/config/departments';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useLoopRegion } from '@/motion/useLoopRegion';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { usePageMeta } from '@/lib/usePageMeta';
import { EASE_CORE } from '@/motion/tokens';
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
import { SALES } from './copy';

/* Route geometry (viewBox 560×300): a flowing line with six stations. */
const STATIONS = [
  { x: 40, y: 200 },
  { x: 130, y: 140 },
  { x: 230, y: 160 },
  { x: 330, y: 110 },
  { x: 430, y: 140 },
  { x: 520, y: 90 },
];
const ROUTE = STATIONS.map((p, i) => {
  if (i === 0) return `M ${p.x} ${p.y}`;
  const prev = STATIONS[i - 1]!;
  const mx = (prev.x + p.x) / 2;
  return `C ${mx} ${prev.y}, ${mx} ${p.y}, ${p.x} ${p.y}`;
}).join(' ');

/** Hero: an order moves along its route toward fulfilment. */
function OrderRoute() {
  const c = useCopy(SALES);
  const reduce = usePrefersReducedMotion();
  const root = useRef<HTMLElement>(null);
  // The sequence pauses while the hero is offscreen or the tab is hidden.
  const live = useLoopRegion(root);
  const [at, setAt] = useState(reduce ? 3 : 0);
  useEffect(() => {
    if (reduce || !live) return;
    const t = window.setInterval(() => setAt((s) => (s + 1) % STATIONS.length), 1700);
    return () => window.clearInterval(t);
  }, [reduce, live]);
  const pos = STATIONS[at]!;
  return (
    <figure ref={root} aria-label={c.hero.visual} className="relative mx-auto w-full max-w-[38rem]">
      <svg aria-hidden viewBox="0 0 560 300" className="w-full overflow-visible">
        <path
          d={ROUTE}
          fill="none"
          stroke="var(--color-ws-sales)"
          strokeOpacity="0.18"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d={ROUTE}
          fill="none"
          stroke="var(--color-ws-sales)"
          strokeOpacity="0.7"
          strokeWidth="2"
          strokeDasharray="6 8"
          className="animate-route"
        />
        {/* Branch: work for Operations when stock is short. */}
        <path
          d="M 230 160 C 250 230, 300 250, 330 250 C 370 250, 410 210, 430 140"
          fill="none"
          stroke="var(--color-ws-operations)"
          strokeOpacity="0.55"
          strokeWidth="1.5"
          strokeDasharray="3 5"
        />
        <rect
          x="270"
          y="236"
          width="120"
          height="28"
          rx="14"
          fill="var(--color-surface-base)"
          stroke="var(--color-ws-operations)"
          strokeOpacity="0.6"
        />
        <text x="330" y="254" textAnchor="middle" fontSize="11" fill="var(--color-text-secondary)">
          {c.hero.branch}
        </text>
        {STATIONS.map((s, i) => (
          <g key={i}>
            <circle
              cx={s.x}
              cy={s.y}
              r={i <= at ? 9 : 7}
              fill={i <= at ? 'var(--color-ws-sales)' : 'var(--color-surface-base)'}
              stroke="var(--color-ws-sales)"
              strokeOpacity="0.8"
              strokeWidth="1.5"
              className="transition-all duration-500"
            />
            <text
              x={s.x}
              y={s.y - 18}
              textAnchor="middle"
              fontSize="11"
              fill={i === at ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}
            >
              {c.hero.route[i]}
            </text>
          </g>
        ))}
      </svg>
      <motion.div
        aria-hidden
        animate={{ left: `${(pos.x / 560) * 100}%`, top: `${(pos.y / 300) * 100}%` }}
        transition={{ duration: reduce ? 0 : 0.9, ease: EASE_CORE }}
        className="absolute -translate-x-1/2 translate-y-3 rounded-lg border border-[color-mix(in_oklab,var(--color-ws-sales)_60%,transparent)] bg-surface-raised px-2.5 py-1 text-[0.6875rem] font-medium whitespace-nowrap text-text-primary shadow-[0_10px_24px_-10px_rgb(0_0_0/0.8)]"
      >
        {c.hero.token}
      </motion.div>
    </figure>
  );
}

function Responsibility() {
  const c = useCopy(SALES);
  return (
    <Section labelledBy="sales-resp">
      <SectionHead
        id="sales-resp"
        eyebrow={c.responsibility.eyebrow}
        title={c.responsibility.title}
        lead={c.responsibility.lead}
      />
      <Reveal stagger className="mt-10 grid gap-8 md:grid-cols-3">
        {c.responsibility.points.map((p, i) => (
          <RevealItem
            key={p.title}
            className="border-l-2 border-[color-mix(in_oklab,var(--dept)_55%,transparent)] pl-5"
          >
            <p className="text-[2.5rem] leading-none font-semibold text-[color-mix(in_oklab,var(--dept)_60%,transparent)] tabular">
              {i + 1}
            </p>
            <h3 className="mt-3 text-h3 text-text-primary">{p.title}</h3>
            <p className="mt-2 text-label text-text-secondary">{p.body}</p>
          </RevealItem>
        ))}
      </Reveal>
    </Section>
  );
}

function Progression() {
  const c = useCopy(SALES);
  const all = useDepartments();
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const stages = c.progression.stages;
  const st = stages[active]!;
  return (
    <Section labelledBy="sales-progress">
      <SectionHead
        id="sales-progress"
        eyebrow={c.progression.eyebrow}
        title={c.progression.title}
        lead={c.progression.lead}
      />
      {/* Stage rail: tabs laid along the order route. */}
      <div
        role="tablist"
        aria-label={c.progression.tabs}
        onKeyDown={(e) => tabKeys(stages.length, active, setActive, tabs)(e)}
        className="relative mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 lg:gap-0"
      >
        <span
          aria-hidden
          className="absolute top-[1.375rem] right-[8%] left-[8%] hidden h-px bg-[color-mix(in_oklab,var(--dept)_35%,transparent)] lg:block"
        />
        {stages.map((s, i) => {
          const on = i === active;
          const passed = i < active;
          return (
            <button
              key={s.name}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`stage-${i}`}
              aria-selected={on}
              aria-controls="stage-detail"
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              className={cn(
                'relative flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors lg:flex-col lg:border-0 lg:bg-transparent lg:px-1 lg:text-center',
                on
                  ? 'border-[color-mix(in_oklab,var(--dept)_55%,transparent)] bg-[color-mix(in_oklab,var(--dept)_10%,transparent)]'
                  : 'border-border-soft',
              )}
            >
              <span
                className={cn(
                  'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-caption tabular transition-colors',
                  on && 'border-[var(--dept)] bg-[var(--dept)] text-text-inverse',
                  passed && 'border-[var(--dept)] bg-surface-base text-[var(--dept)]',
                  !on && !passed && 'border-border-strong bg-surface-base text-text-muted',
                )}
              >
                {passed ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-caption font-medium lg:mt-1',
                  on ? 'text-text-primary' : 'text-text-secondary',
                )}
              >
                {s.name}
              </span>
            </button>
          );
        })}
      </div>
      <div
        id="stage-detail"
        role="tabpanel"
        aria-labelledby={`stage-${active}`}
        className="mt-6 grid gap-4 rounded-card border border-border-soft bg-surface-base/70 p-5 sm:p-6 lg:grid-cols-[1.4fr_1fr_1fr]"
      >
        <div>
          <h3 className="text-h3 text-text-primary">{st.name}</h3>
          <p className="mt-2 text-label text-text-secondary">{st.body}</p>
        </div>
        <div>
          <p className="text-caption text-text-muted">{c.progression.involved}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {st.depts.map((d) => {
              const dept = all.find((x) => x.id === d)!;
              return (
                <li
                  key={d}
                  style={{ '--a': DEPT_ACCENT[d as DeptKey] } as CSSProperties}
                  className="flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--a)_40%,transparent)] px-2.5 py-1 text-caption text-text-primary"
                >
                  <dept.icon className="size-3.5 text-[var(--a)]" aria-hidden />
                  {dept.name}
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <p className="text-caption text-text-muted">{c.progression.customer}</p>
          <p className="mt-2 flex items-center gap-2 rounded-xl border border-border-soft bg-surface-dark/60 px-3 py-2 text-label text-text-primary">
            <MessageSquareText className="size-4 shrink-0 text-[var(--dept)]" aria-hidden />
            {st.tell}
          </p>
        </div>
      </div>
    </Section>
  );
}

function Dependency() {
  const c = useCopy(SALES);
  const d = c.dependency;
  return (
    <Section labelledBy="sales-dep">
      <SectionHead id="sales-dep" eyebrow={d.eyebrow} title={d.title} lead={d.lead} />
      <Reveal className="mt-10">
        <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-border-strong bg-surface-raised px-4 py-2 text-label text-text-primary">
          <GitFork className="size-4 rotate-180 text-[var(--dept)]" aria-hidden />
          {d.check}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            { branch: d.enough, color: 'var(--color-success)', Icon: PackageCheck },
            { branch: d.short, color: 'var(--color-ws-operations)', Icon: Truck },
          ].map(({ branch, color, Icon }) => (
            <div
              key={branch.title}
              style={{ '--b': color } as CSSProperties}
              className="rounded-card border border-[color-mix(in_oklab,var(--b)_40%,transparent)] bg-surface-base/70 p-5"
            >
              <p className="flex items-center gap-2 text-label font-semibold text-text-primary">
                <Icon className="size-4 text-[var(--b)]" aria-hidden />
                {branch.title}
              </p>
              <ol className="mt-4 space-y-3">
                {branch.steps.map((s, i) => (
                  <li key={s} className="flex items-center gap-3 text-label text-text-secondary">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--b)_50%,transparent)] text-caption text-text-primary tabular">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}

function Delivery() {
  const c = useCopy(SALES);
  const d = c.delivery;
  return (
    <Section labelledBy="sales-delivery">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <SectionHead id="sales-delivery" eyebrow={d.eyebrow} title={d.title} lead={d.lead} />
        <Reveal className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-panel border border-line bg-panel p-4">
            <p className="text-caption text-fg-muted">{d.internal}</p>
            <ol className="mt-3 space-y-3">
              {d.steps.map((s) => (
                <li key={s.label} className="flex items-center gap-2.5 text-label">
                  {s.done ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                  ) : (
                    <Circle className="size-4 shrink-0 text-fg-muted" aria-hidden />
                  )}
                  <span className={s.done ? 'text-fg-primary' : 'text-fg-muted'}>{s.label}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="self-end rounded-2xl rounded-bl-sm border border-[color-mix(in_oklab,var(--dept)_45%,transparent)] bg-[color-mix(in_oklab,var(--dept)_8%,transparent)] p-4">
            <p className="text-caption text-text-muted">{d.customerView}</p>
            <p className="mt-2 text-label text-text-primary">{d.message}</p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

export default function SalesPage() {
  const c = useCopy(SALES);
  usePageMeta(c.meta.title, c.meta.description);
  return (
    <DeptPage id="sales">
      <DeptHero
        dept="sales"
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        lead={c.hero.lead}
        visual={<OrderRoute />}
      />
      <Responsibility />
      <TodayBoard id="sales-today" copy={c.today} />
      <Progression />
      <Dependency />
      <Delivery />
      <FlowIO id="sales-io" copy={c.io} />
      <ManagerLens id="sales-manager" copy={c.manager} />
      <ProductPreview
        id="sales-preview"
        dept="sales"
        title={c.preview.title}
        lead={c.preview.lead}
      />
      <ConnectedDepartments id="sales-connected" dept="sales" copy={c.connections} />
      <DeptCta id="sales-cta" dept="sales" />
    </DeptPage>
  );
}
