import { ArrowDown, ArrowRight, Eye } from 'lucide-react';
import { Link } from 'react-router';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Container } from '@/components/ui/Section';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { WORKFLOW } from './copy';
import { CHAPTER, RECORDS, type Actor } from './model';
import { laneColor, useLaneName } from './state';

const BRANCHES: Actor[] = ['sales', 'operations', 'warehouse', 'purchasing', 'accounting'];
const CORE = { x: 292, y: 232 };
const END_X = 560;
const branchY = (i: number) => 112 + i * 60;
const branchPath = (i: number) =>
  `M ${CORE.x + 40} ${CORE.y} C ${CORE.x + 130} ${CORE.y}, ${END_X - 150} ${branchY(i)}, ${END_X} ${branchY(i)}`;
const INCOMING = `M 150 ${CORE.y} L ${CORE.x - 40} ${CORE.y}`;

/** One glowing work object enters CORE and splits into department responsibilities. */
function HeroVisual() {
  const c = useCopy(WORKFLOW);
  const laneName = useLaneName();
  const reduce = usePrefersReducedMotion();
  return (
    <figure aria-label={c.hero.visual} className="relative mx-auto w-full max-w-[40rem]">
      <svg aria-hidden viewBox="0 0 640 440" className="hidden w-full overflow-visible sm:block">
        <defs>
          <radialGradient id="how-core" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="var(--color-brand-glow)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--color-brand-glow)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Executive observes from above */}
        <path
          d="M 330 52 C 420 34, 520 34, 600 52"
          fill="none"
          stroke="var(--color-ws-executive)"
          strokeOpacity="0.55"
          strokeDasharray="3 5"
        />
        <text x="600" y="30" textAnchor="end" fontSize="12" fill="var(--color-ws-executive)">
          {c.hero.observe}
        </text>
        {BRANCHES.map((_, i) => (
          <line
            key={i}
            x1={END_X}
            y1={64}
            x2={END_X}
            y2={branchY(i) - 10}
            stroke="var(--color-ws-executive)"
            strokeOpacity="0.12"
            strokeDasharray="2 6"
          />
        ))}

        {/* Incoming work */}
        <rect
          x="30"
          y={CORE.y - 22}
          width="120"
          height="44"
          rx="12"
          fill="var(--color-surface-raised)"
          stroke="var(--color-brand-glow)"
          strokeOpacity="0.7"
        />
        <text
          x="90"
          y={CORE.y + 5}
          textAnchor="middle"
          fontSize="14"
          fontWeight="600"
          fill="var(--color-text-primary)"
        >
          {RECORDS.salesOrder}
        </text>
        <path d={INCOMING} fill="none" stroke="var(--color-brand-glow)" strokeWidth="2" />

        {/* CORE */}
        <circle cx={CORE.x} cy={CORE.y} r="92" fill="url(#how-core)" />
        <circle
          cx={CORE.x}
          cy={CORE.y}
          r="40"
          fill="var(--color-surface-base)"
          stroke="var(--color-brand-glow)"
          strokeWidth="1.6"
        />
        <circle
          cx={CORE.x}
          cy={CORE.y}
          r="54"
          fill="none"
          stroke="var(--color-brand-glow)"
          strokeOpacity="0.25"
        />
        <text
          x={CORE.x}
          y={CORE.y + 5}
          textAnchor="middle"
          fontSize="15"
          fontWeight="700"
          letterSpacing="2"
          fill="var(--color-brand-soft)"
        >
          CORE
        </text>

        {/* Department responsibilities */}
        {BRANCHES.map((lane, i) => (
          <g key={lane}>
            <path
              d={branchPath(i)}
              fill="none"
              stroke={laneColor(lane)}
              strokeOpacity="0.55"
              strokeWidth="1.6"
            />
            <circle
              cx={END_X}
              cy={branchY(i)}
              r="7"
              fill="var(--color-surface-base)"
              stroke={laneColor(lane)}
              strokeWidth="2"
            />
            <text
              x={END_X + 16}
              y={branchY(i) + 4}
              fontSize="13"
              fill="var(--color-text-secondary)"
            >
              {laneName(lane)}
            </text>
          </g>
        ))}

        {/* The moving work object — static under reduced motion */}
        {reduce ? (
          BRANCHES.map((lane, i) => (
            <circle key={lane} cx={END_X} cy={branchY(i)} r="3" fill={laneColor(lane)} />
          ))
        ) : (
          <>
            <circle r="6" fill="var(--color-brand-glow)">
              <animateMotion dur="1.6s" repeatCount="indefinite" path={INCOMING} />
            </circle>
            {BRANCHES.map((lane, i) => (
              <circle key={lane} r="4" fill={laneColor(lane)}>
                <animateMotion
                  dur="3.2s"
                  begin={`${0.4 * i}s`}
                  repeatCount="indefinite"
                  path={branchPath(i)}
                />
              </circle>
            ))}
          </>
        )}
      </svg>

      {/* Phones: the same idea as a vertical stack */}
      <div className="flex flex-col items-center gap-3 sm:hidden">
        <span className="rounded-xl border border-border-brand bg-surface-raised px-4 py-2 text-label font-semibold text-text-primary tabular">
          {RECORDS.salesOrder}
        </span>
        <ArrowDown aria-hidden className="size-4 text-brand-glow" />
        <span className="flex size-16 items-center justify-center rounded-full border border-brand-glow/70 bg-surface-base text-label font-bold tracking-[0.16em] text-brand-soft">
          CORE
        </span>
        <ArrowDown aria-hidden className="size-4 text-brand-glow" />
        <ul className="flex flex-wrap justify-center gap-2">
          {BRANCHES.map((lane) => (
            <li
              key={lane}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-soft px-3 py-1.5 text-caption text-text-secondary"
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: laneColor(lane) }}
              />
              {laneName(lane)}
            </li>
          ))}
        </ul>
        <p className="inline-flex items-center gap-1.5 text-caption text-[var(--color-ws-executive)]">
          <Eye aria-hidden className="size-3.5" />
          {c.hero.observe}
        </p>
      </div>
    </figure>
  );
}

export function HowHero() {
  const c = useCopy(WORKFLOW);
  const { href } = useLocale();
  return (
    <section
      aria-labelledby="how-title"
      className="relative isolate overflow-hidden pt-28 pb-14 sm:pt-36 sm:pb-20"
    >
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_70%_40%,rgb(25_195_154/0.13),transparent_72%)]" />
        <div className="absolute inset-0 bg-grid [mask-image:linear-gradient(to_bottom,black,transparent_80%)] opacity-50" />
      </div>
      <Container>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-8">
          <div>
            <p className="eyebrow">{c.hero.eyebrow}</p>
            <h1
              id="how-title"
              className="mt-4 text-[clamp(2rem,1.3rem+2.6vw,3.25rem)] leading-[1.3] font-semibold text-balance whitespace-pre-line text-text-primary"
            >
              {c.hero.title}
            </h1>
            <p className="mt-6 max-w-xl text-body-lg text-text-secondary">{c.hero.lead}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {c.hero.points.map((p) => (
                <li
                  key={p}
                  className="rounded-full border border-border-soft bg-surface-base/60 px-3 py-1.5 text-label text-text-secondary"
                >
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={`#${CHAPTER.problem}`} className={buttonClasses('primary', 'lg')}>
                {c.hero.watch}
                <ArrowDown className="size-4" aria-hidden />
              </a>
              <Link to={href('/contact')} className={buttonClasses('secondary', 'lg')}>
                {c.hero.demo}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <p className="mt-6 text-caption text-text-muted">
              {c.common.example} · {c.common.exampleNote}
            </p>
          </div>
          <HeroVisual />
        </div>
      </Container>
    </section>
  );
}
