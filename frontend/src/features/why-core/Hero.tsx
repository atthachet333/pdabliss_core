import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { Chapter, Frame } from '@/components/editorial/Layout';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useDepartments } from '@/config/departments';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { DeptDot, Lines, StoryHead } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { WHY_CORE } from './copy';
import { GROWTH, VIEWERS, WHY_CHAPTER, WHY_LINKS, type Growth } from './model';

/* ------------------------------------------------------------------ */
/* Islands → gaps → the CORE connection layer                           */
/* ------------------------------------------------------------------ */

/**
 * Each island's slight vertical drift (lg) — separate places, not a grid.
 * `rem` mirrors the class so each thread still ends exactly at the CORE layer.
 */
const DRIFT = [
  { cls: 'lg:-translate-y-3', rem: -0.75 },
  { cls: 'lg:translate-y-4', rem: 1 },
  { cls: 'lg:-translate-y-1', rem: -0.25 },
  { cls: 'lg:translate-y-5', rem: 1.25 },
  { cls: 'lg:-translate-y-4', rem: -1 },
  { cls: 'lg:translate-y-2', rem: 0.5 },
];
/** Gap between the islands and the CORE layer on lg (mt-14). */
const LAYER_GAP_REM = 3.5;

function Islands() {
  const c = useCopy(WHY_CORE).hero;
  const departments = useDepartments();
  const reduce = usePrefersReducedMotion();
  const name = (id: string) => departments.find((d) => d.id === id)!.name;
  return (
    <figure aria-label={c.visual} data-hero-visual className="relative">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-[repeat(6,minmax(0,1fr))] lg:gap-x-10">
        {VIEWERS.map((id, i) => (
          <motion.li
            key={id}
            data-island={id}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.08, duration: 0.7, ease: EASE_CORE }}
            className={cn('relative', DRIFT[i]!.cls)}
          >
            <div className="relative rounded-[1.75rem] bg-[radial-gradient(ellipse_80%_70%_at_50%_30%,rgb(255_255_255/0.06),rgb(255_255_255/0.015))] px-4 py-5 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.09)]">
              <span
                aria-hidden
                className="absolute inset-x-6 -bottom-px h-px"
                style={{
                  background: `linear-gradient(90deg,transparent,var(--color-ws-${id}),transparent)`,
                }}
              />
              <p className="flex items-center gap-2 text-label font-semibold text-text-primary">
                <DeptDot id={id} />
                {name(id)}
              </p>
              <div aria-hidden className="mt-3 space-y-1.5">
                <span className="block h-1.5 w-4/5 rounded-full bg-white/10" />
                <span className="block h-1.5 w-3/5 rounded-full bg-white/[0.07]" />
              </div>
            </div>
            {/* Where work waits between this island and the next */}
            {i < VIEWERS.length - 1 && (
              <span
                aria-hidden
                className="absolute top-1/2 -right-5 hidden translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 lg:flex"
              >
                <span className="size-2 rounded-full bg-warning/80 shadow-[0_0_10px_rgb(245_184_75/0.5)]" />
                <span className="text-[0.6875rem] text-warning/70">{c.gap}</span>
              </span>
            )}
            {/* The thread down to the CORE layer */}
            <motion.span
              aria-hidden
              style={{ height: `${LAYER_GAP_REM - DRIFT[i]!.rem}rem` }}
              className="absolute top-full left-1/2 hidden w-px origin-top bg-[linear-gradient(to_bottom,rgb(62_240_192/0.15),rgb(62_240_192/0.7))] lg:block"
              initial={reduce ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 1.1 + i * 0.06, duration: 0.5, ease: EASE_CORE }}
            />
          </motion.li>
        ))}
      </ul>
      <motion.div
        data-core-layer
        initial={reduce ? false : { opacity: 0, scaleX: 0.6 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.9, duration: 0.9, ease: EASE_CORE }}
        className="relative mt-8 rounded-2xl bg-[linear-gradient(90deg,rgb(25_195_154/0.08),rgb(25_195_154/0.24),rgb(25_195_154/0.08))] px-5 py-4 text-center shadow-[inset_0_0_0_1px_rgb(62_240_192/0.35),0_30px_90px_-40px_rgb(62_240_192/0.7)] lg:mt-14"
      >
        <p className="text-caption font-semibold text-brand-glow">{c.layer}</p>
      </motion.div>
    </figure>
  );
}

export function WhyCoreHero() {
  const c = useCopy(WHY_CORE).hero;
  const { href } = useLocale();
  return (
    <section aria-labelledby="why-core-title" className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_45%_at_50%_100%,rgb(62_224_180/0.1),transparent_70%),radial-gradient(ellipse_50%_40%_at_15%_10%,rgb(90_169_255/0.05),transparent_70%)]"
      />
      <Frame width="wide" className="pt-28 pb-20 sm:pt-32 lg:pt-40 lg:pb-28">
        <p className="flex items-center gap-3 text-caption font-semibold text-brand-soft">
          <span aria-hidden className="h-px w-6 bg-current opacity-70" />
          {c.eyebrow}
        </p>
        <h1
          id="why-core-title"
          className="mt-6 max-w-5xl text-[clamp(1.875rem,1.05rem+3.2vw,4.25rem)] leading-[1.18] font-semibold tracking-tight"
        >
          <span className="block text-text-muted">
            <Lines text={c.titleA} />
          </span>
          <span className="mt-4 block text-gradient-brand sm:mt-6">
            <Lines text={c.titleB} />
          </span>
        </h1>
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <p className="max-w-2xl border-l-2 border-brand-primary/50 pl-5 text-body-lg text-text-secondary">
            {c.lead}
          </p>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Link
              to={href(WHY_LINKS.howCoreWorks)}
              data-cta="how"
              className={buttonClasses('primary', 'lg')}
            >
              {c.primary}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              to={href(WHY_LINKS.about)}
              data-cta="about"
              className={buttonClasses('secondary', 'lg')}
            >
              {c.about}
            </Link>
          </div>
        </div>
        <div className="mt-16 lg:mt-24">
          <Islands />
        </div>
      </Frame>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 01 Origin — what happens as organizations grow                       */
/* ------------------------------------------------------------------ */

const P = {
  dot: '#e8fff7',
  line: '#a3b8b2',
  warn: '#f5b84b',
  lit: '#3ef0c0',
};
const WS = ['sales', 'warehouse', 'operations', 'purchasing', 'accounting', 'executive'];
const ws = (i: number) => `var(--color-ws-${WS[i % WS.length]})`;

/** Small multiples: the same organization, one stage further each time. */
function GrowthSketch({ stage }: { stage: Growth }) {
  const groups = [
    { x: 40, y: 72 },
    { x: 110, y: 40 },
    { x: 170, y: 92 },
  ];
  const cluster = (gx: number, gy: number, k: number) =>
    [0, 1, 2].map((j) => (
      <circle key={j} cx={gx - 10 + j * 10} cy={gy + (j % 2 ? 6 : -4)} r="3.6" fill={ws(k)} />
    ));
  switch (stage) {
    case 'roles':
      return (
        <g>
          {[
            [70, 60],
            [100, 46],
            [130, 64],
            [86, 92],
            [120, 98],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="5" fill={ws(i)} />
          ))}
          <circle
            cx="100"
            cy="72"
            r="52"
            fill="none"
            stroke={P.line}
            strokeOpacity="0.25"
            strokeDasharray="3 5"
          />
        </g>
      );
    case 'departments':
      return (
        <g>
          {groups.map((g, k) => (
            <g key={k}>
              <rect
                x={g.x - 24}
                y={g.y - 18}
                width="48"
                height="34"
                rx="10"
                fill="none"
                stroke={ws(k)}
                strokeOpacity="0.55"
              />
              {cluster(g.x, g.y, k)}
            </g>
          ))}
        </g>
      );
    case 'handoffs':
    case 'approvals':
      return (
        <g>
          {groups.map((g, k) => (
            <g key={k}>
              <rect
                x={g.x - 24}
                y={g.y - 18}
                width="48"
                height="34"
                rx="10"
                fill="none"
                stroke={ws(k)}
                strokeOpacity="0.55"
              />
              {cluster(g.x, g.y, k)}
            </g>
          ))}
          <path
            d="M 64 66 L 86 48"
            stroke={P.line}
            strokeOpacity="0.6"
            markerEnd="url(#why-arrow)"
          />
          <path
            d="M 134 50 L 150 78"
            stroke={P.line}
            strokeOpacity="0.6"
            markerEnd="url(#why-arrow)"
          />
          <path
            d="M 146 100 Q 100 128 62 92"
            fill="none"
            stroke={P.line}
            strokeOpacity="0.6"
            markerEnd="url(#why-arrow)"
          />
          {stage === 'approvals' &&
            [
              [75, 57],
              [142, 64],
              [104, 116],
            ].map(([x, y], i) => (
              <rect
                key={i}
                x={x! - 5}
                y={y! - 5}
                width="10"
                height="10"
                transform={`rotate(45 ${x} ${y})`}
                fill="#0c1822"
                stroke={P.warn}
                strokeOpacity="0.85"
              />
            ))}
        </g>
      );
    case 'systems':
      return (
        <g>
          {groups.map((g, k) => (
            <g key={k}>
              <rect
                x={g.x - 24}
                y={g.y - 18}
                width="48"
                height="34"
                rx="10"
                fill="none"
                stroke={ws(k)}
                strokeOpacity="0.55"
              />
              {cluster(g.x, g.y, k)}
            </g>
          ))}
          {[
            [20, 20],
            [180, 22],
            [196, 130],
            [14, 124],
          ].map(([x, y], i) => (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width="16"
                height="12"
                rx="2"
                fill="#0c1822"
                stroke={P.line}
                strokeOpacity="0.7"
              />
              <line
                x1={x! + 8}
                y1={y! + 12}
                x2={groups[i % 3]!.x}
                y2={groups[i % 3]!.y}
                stroke={P.line}
                strokeOpacity="0.3"
                strokeDasharray="2 3"
              />
            </g>
          ))}
        </g>
      );
    case 'visibility':
      return (
        <g opacity="0.55">
          {groups.map((g, k) => (
            <g key={k}>
              <rect
                x={g.x - 24}
                y={g.y - 18}
                width="48"
                height="34"
                rx="10"
                fill="none"
                stroke={ws(k)}
                strokeOpacity="0.4"
              />
              {cluster(g.x, g.y, k)}
            </g>
          ))}
          <rect x="0" y="0" width="210" height="140" fill="url(#why-fog)" />
          <circle cx="105" cy="16" r="6" fill="none" stroke={P.lit} strokeOpacity="0.8" />
          {[40, 110, 170].map((x) => (
            <line
              key={x}
              x1="105"
              y1="22"
              x2={x}
              y2="60"
              stroke={P.lit}
              strokeOpacity="0.25"
              strokeDasharray="1 4"
            />
          ))}
        </g>
      );
  }
}

export function OriginChapter() {
  const c = useCopy(WHY_CORE).origin;
  return (
    <Chapter id={WHY_CHAPTER.origin} labelledBy="origin-title" space="lg">
      <Frame width="wide">
        <StoryHead
          index="01"
          kicker={c.kicker}
          id="origin-title"
          title={c.title}
          lead={c.lead}
          className="max-w-4xl"
        />
        <figure aria-label={c.visual} className="mt-16 lg:mt-20">
          <svg width="0" height="0" className="absolute" aria-hidden>
            <defs>
              <marker
                id="why-arrow"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" fill={P.line} fillOpacity="0.8" />
              </marker>
              <linearGradient id="why-fog" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#050b12" stopOpacity="0" />
                <stop offset="100%" stopColor="#050b12" stopOpacity="0.85" />
              </linearGradient>
            </defs>
          </svg>
          <ol
            data-growth
            className="grid grid-cols-1 gap-x-6 gap-y-10 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
          >
            {GROWTH.map((g, i) => (
              <li key={g} data-growth-stage={g} className="border-t border-border-soft pt-5">
                <p aria-hidden className="text-caption text-text-muted tabular">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <svg viewBox="0 0 210 140" className="mt-3 block w-full max-w-[16rem]" aria-hidden>
                  <GrowthSketch stage={g} />
                </svg>
                <h3
                  className={cn(
                    'mt-4 text-label font-semibold',
                    g === 'visibility' ? 'text-warning' : 'text-text-primary',
                  )}
                >
                  {c.stages[g].title}
                </h3>
                <p className="mt-1 text-caption text-text-secondary">{c.stages[g].body}</p>
              </li>
            ))}
          </ol>
        </figure>
        <p className="mt-16 max-w-3xl text-[clamp(1.1875rem,1.05rem+0.6vw,1.625rem)] leading-[1.55] font-medium text-text-primary">
          {c.conclusion}
        </p>
      </Frame>
    </Chapter>
  );
}
