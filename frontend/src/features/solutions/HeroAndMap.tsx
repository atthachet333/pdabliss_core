import { motion } from 'framer-motion';
import { ArrowDown, ArrowRight, CheckCircle2, Eye } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useMediaQuery } from '@/components/core/hooks';
import { Segmented } from '@/components/ui/Segmented';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useDepartments } from '@/config/departments';
import type { DeptKey } from '@/features/departments/catalog';
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
import { Chapter, ChapterTitle, Frame, Kicker, ToneBadge } from './parts';

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
    <figure aria-label={c.visual} className="relative mx-auto w-full max-w-[56rem]">
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
      className="relative isolate flex flex-col overflow-hidden pt-28 pb-16 sm:pt-36 lg:min-h-[min(100svh,64rem)] lg:pt-40 lg:pb-20"
    >
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_55%_at_78%_38%,rgb(245_184_75/0.06),transparent_70%),radial-gradient(ellipse_60%_65%_at_70%_65%,rgb(25_195_154/0.11),transparent_72%)]" />
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_70%_70%_at_70%_45%,black,transparent_80%)] opacity-60" />
      </div>
      <Frame width="full" className="flex flex-1 flex-col">
        <div className="grid flex-1 grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-8">
          <div className="max-w-2xl">
            <p className="eyebrow">{c.eyebrow}</p>
            <h1
              id="solutions-title"
              className="mt-6 text-[clamp(2rem,1.2rem+2.6vw,3.6rem)] leading-[1.26] font-semibold tracking-tight text-balance whitespace-pre-line text-text-primary"
            >
              {c.title}
            </h1>
            <p className="mt-8 max-w-lg text-body-lg text-text-secondary">{c.lead}</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
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
          <div className="lg:-mr-6 xl:-mr-10">
            <HeroVisual />
          </div>
        </div>
        {/* The core story — an open strip, not a card */}
        <div
          className="mt-16 grid grid-cols-1 gap-6 border-t border-border-soft pt-8 lg:mt-20 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-8"
          data-hero-story
        >
          <div>
            <p className="text-body-lg font-semibold text-text-primary">{c.storyTitle}</p>
            <p className="mt-1 text-label text-text-muted">{c.story}</p>
          </div>
          <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {c.causes.map((cause, i) => (
              <li key={cause} className="flex items-baseline gap-3 text-label text-text-secondary">
                <span aria-hidden className="text-caption text-warning tabular">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {cause}
              </li>
            ))}
          </ul>
        </div>
      </Frame>
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
    <Chapter id={SECTION.map} labelledBy="map-title" plane="grid" space="lg">
      <Frame
        width="full"
        className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]"
      >
        <div className="relative z-10">
          <Kicker tone="clear">{m.eyebrow}</Kicker>
          <ChapterTitle id="map-title" className="mt-4">
            {m.title}
          </ChapterTitle>
          <p className="mt-5 text-body text-text-secondary">{m.lead}</p>
          <Segmented<'before' | 'after'>
            label={m.view}
            value={view}
            onChange={setView}
            options={[
              { value: 'before', label: m.before },
              { value: 'after', label: m.after },
            ]}
            className="mt-8 grid w-full grid-cols-2"
          />
          {/* Compact legend */}
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2">
            {(['attention', 'blocked', 'waiting', 'resolved'] as const).map((t) => (
              <li key={t}>
                <ToneBadge tone={t} />
              </li>
            ))}
          </ul>
        </div>
        {wide ? (
          <div
            className="relative mx-auto w-full max-w-[64rem]"
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
              <g
                style={{ opacity: resolved ? 1 : 0.25 }}
                className="transition-opacity duration-500"
              >
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
          <ul
            className="divide-y divide-border-soft border-y border-border-soft"
            data-problem-map
            data-view={view}
          >
            {[...placed, cross].map((s) => (
              <li key={s.id} className="flex flex-col gap-1.5 py-3">
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
      </Frame>
    </Chapter>
  );
}
