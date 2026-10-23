import { motion } from 'framer-motion';
import { ArrowDown, ArrowRight, CheckCircle2, Eye } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useMediaQuery } from '@/components/core/hooks';
import { Segmented } from '@/components/ui/Segmented';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Container } from '@/components/ui/Section';
import { useDepartments } from '@/config/departments';
import type { DeptKey } from '@/features/departments/catalog';
import { Section, SectionHead } from '@/features/departments/ui';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { SOLUTIONS_COPY } from './copy';
import {
  frictionPoint,
  MAP_CORE,
  MAP_EDGES,
  MAP_NODES,
  SECTION,
  SOLUTIONS,
  type MapNode,
} from './model';
import { ToneBadge } from './parts';

const deptName = (list: ReturnType<typeof useDepartments>, id: DeptKey) =>
  list.find((d) => d.id === id)!.name;

/* ------------------------------------------------------------------ */
/* Hero                                                                 */
/* ------------------------------------------------------------------ */

const ROW: DeptKey[] = ['sales', 'operations', 'warehouse', 'purchasing', 'accounting'];
const RX = (i: number) => 64 + i * 128;
const RY = 168;

/** A calm system; friction appears at the joins; CORE reconnects them. Plays once. */
function HeroVisual() {
  const c = useCopy(SOLUTIONS_COPY).hero;
  const departments = useDepartments();
  const reduce = usePrefersReducedMotion();
  const fade = (delay: number) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: -6 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.5, ease: EASE_CORE },
        };
  // Friction on each join (four neighbours) plus one long handoff arc.
  const joins = [1, 2, 3, 4];
  const labels = [c.frictions[1], c.frictions[2], c.frictions[3], c.frictions[4]];
  return (
    <figure aria-label={c.visual} className="relative mx-auto w-full max-w-[42rem]">
      <svg aria-hidden viewBox="0 0 640 330" className="hidden w-full overflow-visible sm:block">
        {/* Executive observes */}
        <circle
          cx="320"
          cy="34"
          r="16"
          fill="var(--color-surface-raised)"
          stroke="var(--color-ws-executive)"
          strokeWidth="1.5"
        />
        <text x="320" y="39" textAnchor="middle" fontSize="13" fill="var(--color-ws-executive)">
          ◉
        </text>
        <text x="346" y="39" fontSize="12" fill="var(--color-text-muted)">
          {deptName(departments, 'executive')}
        </text>

        {/* The long handoff that goes missing */}
        <path
          d={`M ${RX(0)} ${RY - 18} C ${RX(0) + 60} 70, ${RX(2) - 60} 70, ${RX(2)} ${RY - 18}`}
          fill="none"
          stroke="var(--color-border-strong)"
          strokeDasharray="4 6"
        />
        <motion.g {...fade(0.5)}>
          <rect
            x={RX(1) - 52}
            y="78"
            width="104"
            height="24"
            rx="12"
            fill="var(--color-surface-base)"
            stroke="var(--color-warning)"
            strokeOpacity="0.6"
          />
          <text x={RX(1)} y="94" textAnchor="middle" fontSize="11.5" fill="var(--color-warning)">
            {c.frictions[0]}
          </text>
        </motion.g>

        {/* Joins between neighbours, each with a gap */}
        {joins.map((j, k) => {
          const x1 = RX(j - 1) + 18;
          const x2 = RX(j) - 18;
          const mx = (x1 + x2) / 2;
          return (
            <g key={j}>
              <line
                x1={x1}
                y1={RY}
                x2={mx - 9}
                y2={RY}
                stroke="var(--color-border-strong)"
                strokeWidth="1.5"
              />
              <line
                x1={mx + 9}
                y1={RY}
                x2={x2}
                y2={RY}
                stroke="var(--color-border-strong)"
                strokeWidth="1.5"
              />
              <motion.g {...fade(0.8 + k * 0.25)}>
                <path
                  d={`M ${mx - 5} ${RY - 6} l 10 12 M ${mx + 5} ${RY - 6} l -10 12`}
                  stroke="var(--color-warning)"
                  strokeWidth="1.6"
                />
                <text
                  x={mx}
                  y={RY + 32}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--color-warning)"
                >
                  {labels[k]}
                </text>
              </motion.g>
            </g>
          );
        })}

        {/* Departments — stable */}
        {ROW.map((d, i) => (
          <g key={d}>
            <circle
              cx={RX(i)}
              cy={RY}
              r="18"
              fill="var(--color-surface-raised)"
              stroke={`var(--color-ws-${d})`}
              strokeWidth="2"
            />
            <text
              x={RX(i)}
              y={RY - 28}
              textAnchor="middle"
              fontSize="12.5"
              fill="var(--color-text-secondary)"
            >
              {deptName(departments, d)}
            </text>
          </g>
        ))}

        {/* CORE reconnects underneath */}
        <motion.path
          d={`M ${RX(0)} ${RY + 18} C ${RX(0)} 290, ${RX(4)} 290, ${RX(4)} ${RY + 18}`}
          fill="none"
          stroke="var(--color-brand-glow)"
          strokeWidth="2"
          {...(reduce
            ? {}
            : {
                initial: { pathLength: 0, opacity: 0 },
                animate: { pathLength: 1, opacity: 1 },
                transition: { delay: 2, duration: 1.4, ease: EASE_CORE },
              })}
        />
        {ROW.slice(1, 4).map((d, i) => (
          <line
            key={d}
            x1={RX(i + 1)}
            y1={RY + 18}
            x2={RX(i + 1)}
            y2={262}
            stroke="var(--color-brand-glow)"
            strokeOpacity="0.5"
            strokeDasharray="3 4"
          />
        ))}
        <motion.g {...fade(2.6)}>
          <rect
            x="250"
            y="276"
            width="140"
            height="28"
            rx="14"
            fill="var(--color-surface-base)"
            stroke="var(--color-brand-glow)"
          />
          <text
            x="320"
            y="294"
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="var(--color-brand-soft)"
          >
            {c.reconnect}
          </text>
        </motion.g>
      </svg>

      {/* Phones: departments and the friction between them, as text */}
      <div className="sm:hidden">
        <ul className="flex flex-wrap gap-2">
          {ROW.map((d) => (
            <li
              key={d}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-soft px-3 py-1.5 text-caption text-text-secondary"
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: `var(--color-ws-${d})` }}
              />
              {deptName(departments, d)}
            </li>
          ))}
        </ul>
        <ul className="mt-3 flex flex-wrap gap-2">
          {c.frictions.map((f) => (
            <li key={f}>
              <ToneBadge
                tone="attention"
                label={f}
                className="rounded-full border border-warning/40 px-3 py-1.5"
              />
            </li>
          ))}
        </ul>
        <p className="mt-3 inline-flex items-center gap-1.5 text-caption text-brand-soft">
          <CheckCircle2 aria-hidden className="size-3.5" />
          {c.reconnect}
        </p>
      </div>
      <figcaption className="mt-3 text-center text-caption text-text-muted">{c.between}</figcaption>
    </figure>
  );
}

export function SolutionsHero() {
  const c = useCopy(SOLUTIONS_COPY).hero;
  const { href } = useLocale();
  return (
    <section
      aria-labelledby="solutions-title"
      className="relative isolate overflow-hidden pt-28 pb-14 sm:pt-36 sm:pb-20"
    >
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_55%_at_75%_40%,rgb(245_184_75/0.06),transparent_70%),radial-gradient(ellipse_55%_60%_at_60%_70%,rgb(25_195_154/0.1),transparent_72%)]" />
        <div className="absolute inset-0 bg-grid [mask-image:linear-gradient(to_bottom,black,transparent_80%)] opacity-50" />
      </div>
      <Container>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
          <div>
            <p className="eyebrow">{c.eyebrow}</p>
            <h1
              id="solutions-title"
              className="mt-4 text-[clamp(1.875rem,1.25rem+2.2vw,3rem)] leading-[1.32] font-semibold text-balance whitespace-pre-line text-text-primary"
            >
              {c.title}
            </h1>
            <p className="mt-6 max-w-xl text-body-lg text-text-secondary">{c.lead}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={`#${SECTION.map}`} className={buttonClasses('primary', 'lg')}>
                {c.map}
                <ArrowDown className="size-4" aria-hidden />
              </a>
              <Link to={href('/how-core-works')} className={buttonClasses('secondary', 'lg')}>
                {c.how}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
          <HeroVisual />
        </div>
        {/* The core story: information exists, but it is scattered */}
        <div
          className="mt-14 grid grid-cols-1 gap-6 rounded-[1.75rem] border border-border-soft bg-surface-base/60 p-6 sm:p-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
          data-hero-story
        >
          <div>
            <p className="text-body-lg font-semibold text-text-primary">{c.storyTitle}</p>
            <p className="mt-1 text-label text-text-secondary">{c.story}</p>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {c.causes.map((cause) => (
              <li key={cause} className="flex items-start gap-2 text-label text-text-secondary">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-warning/80" />
                {cause}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Problem map                                                          */
/* ------------------------------------------------------------------ */

const W = 640;
const H = 440;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;
const sameEdge = (e: readonly [MapNode, MapNode], f: readonly [MapNode, MapNode] | null) =>
  !!f && ((e[0] === f[0] && e[1] === f[1]) || (e[0] === f[1] && e[1] === f[0]));

export function ProblemMap() {
  const c = useCopy(SOLUTIONS_COPY);
  const m = c.map;
  const departments = useDepartments();
  const wide = useMediaQuery('(min-width: 48rem)');
  const [view, setView] = useState<'before' | 'after'>('before');
  const resolved = view === 'after';
  const placed = SOLUTIONS.filter((s) => s.between);
  const cross = SOLUTIONS.find((s) => !s.between)!;
  const chip = (s: (typeof SOLUTIONS)[number]) => (
    <a
      href={`#${s.anchor}`}
      data-friction={s.id}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-caption font-medium whitespace-nowrap shadow-[0_8px_24px_-12px_rgb(0_0_0/0.9)] transition-colors duration-300',
        resolved
          ? 'border-border-brand/60 bg-surface-raised text-text-primary hover:border-brand-glow'
          : 'border-warning/45 bg-surface-base text-text-primary hover:border-warning',
      )}
    >
      <ToneBadge
        tone={resolved ? 'resolved' : s.tone}
        label={resolved ? m.resolved[s.id] : m.friction[s.id]}
      />
      <span className="sr-only">— {m.open}</span>
    </a>
  );
  return (
    <Section id={SECTION.map} labelledBy="map-title" className="scroll-mt-20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <SectionHead id="map-title" eyebrow={m.eyebrow} title={m.title} lead={m.lead} />
        <Segmented<'before' | 'after'>
          label={m.view}
          value={view}
          onChange={setView}
          options={[
            { value: 'before', label: m.before },
            { value: 'after', label: m.after },
          ]}
          className="grid w-full shrink-0 grid-cols-2 sm:w-80"
        />
      </div>

      {wide ? (
        <div
          className="relative mx-auto mt-10 w-full max-w-[52rem]"
          style={{ aspectRatio: `${W} / ${H}` }}
          data-problem-map
          data-view={view}
        >
          <svg
            aria-hidden
            viewBox={`0 0 ${W} ${H}`}
            className="absolute inset-0 size-full overflow-visible"
          >
            {MAP_EDGES.map((e) => {
              const a = MAP_NODES[e[0]];
              const b = MAP_NODES[e[1]];
              const friction = placed.find((s) => sameEdge(e, s.between));
              if (!friction || resolved) {
                return (
                  <line
                    key={e.join('-')}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={resolved ? 'var(--color-brand-glow)' : 'var(--color-border-soft)'}
                    strokeOpacity={resolved ? 0.55 : 1}
                    strokeWidth={resolved ? 1.8 : 1.2}
                    className="transition-[stroke] duration-500"
                  />
                );
              }
              // A broken join: the line stops short on both sides of the friction.
              const p = frictionPoint(friction)!;
              const t = 0.18;
              return (
                <g key={e.join('-')}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={p.x + (a.x - p.x) * t}
                    y2={p.y + (a.y - p.y) * t}
                    stroke="var(--color-warning)"
                    strokeOpacity="0.45"
                    strokeWidth="1.4"
                    strokeDasharray="5 4"
                  />
                  <line
                    x1={b.x}
                    y1={b.y}
                    x2={p.x + (b.x - p.x) * t}
                    y2={p.y + (b.y - p.y) * t}
                    stroke="var(--color-warning)"
                    strokeOpacity="0.45"
                    strokeWidth="1.4"
                    strokeDasharray="5 4"
                  />
                </g>
              );
            })}
            {/* With CORE: every department also connects through the centre */}
            {resolved &&
              (Object.keys(MAP_NODES) as MapNode[]).map((n) => (
                <line
                  key={`spoke-${n}`}
                  x1={MAP_CORE.x}
                  y1={MAP_CORE.y}
                  x2={MAP_NODES[n].x}
                  y2={MAP_NODES[n].y}
                  stroke="var(--color-brand-glow)"
                  strokeOpacity="0.22"
                  strokeDasharray="2 5"
                />
              ))}
            {/* CORE at the centre when the joins are reconnected */}
            <g style={{ opacity: resolved ? 1 : 0.25 }} className="transition-opacity duration-500">
              <circle
                cx={MAP_CORE.x}
                cy={MAP_CORE.y}
                r="38"
                fill="var(--color-surface-base)"
                stroke="var(--color-brand-glow)"
                strokeWidth="1.5"
                strokeDasharray={resolved ? undefined : '4 5'}
              />
              <text
                x={MAP_CORE.x}
                y={MAP_CORE.y + 5}
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                letterSpacing="2"
                fill="var(--color-brand-soft)"
              >
                {m.core}
              </text>
            </g>
          </svg>
          {/* Department nodes — stable */}
          {(Object.keys(MAP_NODES) as MapNode[]).map((n) => (
            <span
              key={n}
              data-map-node={n}
              className="absolute inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-border-strong bg-surface-raised px-3.5 py-2 text-label font-medium text-text-primary"
              style={{ left: pct(MAP_NODES[n].x, W), top: pct(MAP_NODES[n].y, H) }}
            >
              {n === 'executive' ? (
                <Eye aria-hidden className="size-4 text-[var(--color-ws-executive)]" />
              ) : (
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ background: `var(--color-ws-${n})` }}
                />
              )}
              {deptName(departments, n)}
            </span>
          ))}
          {/* Frictions sit on the joins */}
          <ul>
            {placed.map((s) => {
              const p = frictionPoint(s)!;
              return (
                <li
                  key={s.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: pct(p.x, W), top: pct(p.y, H) }}
                >
                  {chip(s)}
                </li>
              );
            })}
            <li
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: pct(MAP_CORE.x, W), top: pct(MAP_CORE.y + 62, H) }}
            >
              {chip(cross)}
            </li>
          </ul>
        </div>
      ) : (
        <ul className="mt-8 space-y-2" data-problem-map data-view={view}>
          {[...placed, cross].map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface-base/60 p-3"
            >
              <span className="text-caption text-text-muted">
                {s.between
                  ? `${deptName(departments, s.between[0])} ↔ ${deptName(departments, s.between[1])}`
                  : c.common.departments}
              </span>
              <span>{chip(s)}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
