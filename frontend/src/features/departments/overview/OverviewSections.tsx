import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { Container } from '@/components/ui/Section';
import { useDepartments, type DepartmentInfo } from '@/config/departments';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useLocale } from '@/i18n/useLocale';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { Reveal, RevealItem } from '@/motion/Reveal';
import { DEPT_ACCENT, DEPT_PAGES, deptPath, type DeptKey } from '../catalog';
import { DEPT_SUMMARIES } from '../summaries';
import { tabKeys } from '../tabs';
import { Section, SectionHead } from '../ui';
import { OVERVIEW } from './copy';

function usePages(): DepartmentInfo[] {
  const all = useDepartments();
  return DEPT_PAGES.map((id) => all.find((d) => d.id === id)!);
}

/* ------------------------------------------------------------------------ */
/* Hero — CORE with six department environments blooming outward            */
/* ------------------------------------------------------------------------ */

const BLOOM = DEPT_PAGES.map((id, i) => {
  const a = (-90 + i * 60) * (Math.PI / 180);
  return { id, x: 50 + Math.cos(a) * 36, y: 50 + Math.sin(a) * 34 };
});

function DepartmentBloom({ label }: { label: string }) {
  const pages = usePages();
  const reduce = usePrefersReducedMotion();
  return (
    <figure aria-label={label} className="relative mx-auto aspect-square w-full max-w-[36rem]">
      <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 size-full">
        <defs>
          <radialGradient id="bloom-core" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#1d5a52" />
            <stop offset="60%" stopColor="#0a1620" />
            <stop offset="100%" stopColor="#050b12" />
          </radialGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="var(--color-brand-glow)"
          strokeOpacity="0.08"
        />
        <circle
          cx="50"
          cy="50"
          r="30"
          fill="none"
          stroke="var(--color-brand-glow)"
          strokeOpacity="0.1"
          strokeDasharray="0.6 1.6"
        />
        {BLOOM.map((p) => (
          <line
            key={p.id}
            x1="50"
            y1="50"
            x2={p.x}
            y2={p.y}
            stroke={DEPT_ACCENT[p.id]}
            strokeOpacity="0.55"
            strokeWidth="0.35"
            strokeDasharray="1.2 2.4"
            className="animate-flow"
          />
        ))}
        <circle
          cx="50"
          cy="50"
          r="13"
          fill="url(#bloom-core)"
          stroke="var(--color-brand-glow)"
          strokeOpacity="0.55"
          strokeWidth="0.4"
        />
      </svg>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
      >
        <span className="text-[0.55rem] font-semibold tracking-[0.3em] text-brand-soft/80 sm:text-[0.625rem]">
          PDA BLISS
        </span>
        <span className="text-gradient-brand text-lg leading-none font-semibold tracking-[0.18em] sm:text-2xl">
          CORE
        </span>
      </div>
      {BLOOM.map((p, i) => {
        const d = pages.find((x) => x.id === p.id)!;
        return (
          <motion.div
            key={p.id}
            aria-hidden
            initial={reduce ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.07, duration: 0.6, ease: EASE_CORE }}
            style={{ left: `${p.x}%`, top: `${p.y}%`, '--a': DEPT_ACCENT[p.id] } as CSSProperties}
            className="absolute w-[30%] -translate-x-1/2 -translate-y-1/2"
          >
            <div className="overflow-hidden rounded-lg border border-[color-mix(in_oklab,var(--a)_40%,transparent)] bg-surface-base shadow-[0_18px_40px_-20px_rgb(0_0_0/0.9)] sm:rounded-xl">
              <img
                src={d.image.sm}
                alt=""
                width={400}
                height={225}
                decoding="async"
                className="aspect-[16/10] w-full object-cover"
              />
              <p className="flex items-center gap-1 truncate px-1.5 py-1 text-[0.625rem] font-medium text-text-primary sm:px-2 sm:text-caption">
                <span className="size-1.5 shrink-0 rounded-full bg-[var(--a)]" />
                {d.name}
              </p>
            </div>
          </motion.div>
        );
      })}
    </figure>
  );
}

export function OverviewHero() {
  const c = useCopy(OVERVIEW);
  return (
    <section
      aria-labelledby="departments-title"
      className="relative isolate overflow-hidden pt-28 pb-12 sm:pt-36 sm:pb-20"
    >
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_72%_45%,rgb(25_195_154/0.12),transparent_70%)]" />
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_70%)] opacity-60" />
      </div>
      <Container className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div>
          <p className="eyebrow">{c.hero.eyebrow}</p>
          <h1
            id="departments-title"
            className="mt-5 text-display whitespace-pre-line text-text-primary lg:text-[clamp(2.5rem,1.6rem+2vw,3.4rem)]"
          >
            {c.hero.title}
          </h1>
          <p className="mt-6 max-w-xl text-body-lg text-text-secondary">{c.hero.lead}</p>
        </div>
        <DepartmentBloom label={c.hero.visual} />
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Why separate workspaces                                                   */
/* ------------------------------------------------------------------------ */

function OneSystemDiagram() {
  return (
    <div
      aria-hidden
      className="grid grid-cols-4 gap-1.5 rounded-xl border border-border-soft bg-surface-dark/60 p-3"
    >
      {Array.from({ length: 16 }, (_, i) => (
        <span key={i} className="h-5 rounded-md bg-text-muted/15" />
      ))}
    </div>
  );
}

function CoreDiagram() {
  return (
    <div
      aria-hidden
      className="relative grid grid-cols-3 gap-1.5 rounded-xl border border-border-brand/30 bg-surface-dark/60 p-3"
    >
      {DEPT_PAGES.map((id) => (
        <span
          key={id}
          style={{ '--a': DEPT_ACCENT[id] } as CSSProperties}
          className="flex h-9 items-end rounded-md border border-[color-mix(in_oklab,var(--a)_35%,transparent)] bg-[color-mix(in_oklab,var(--a)_8%,transparent)] p-1"
        >
          <span className="h-1 w-2/3 rounded-full bg-[var(--a)] opacity-70" />
        </span>
      ))}
      <span className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-brand-glow/50 bg-surface-base text-[0.5rem] tracking-[0.15em] text-brand-glow">
        CORE
      </span>
    </div>
  );
}

export function WhyWorkspaces() {
  const c = useCopy(OVERVIEW);
  return (
    <Section labelledBy="why-title">
      <SectionHead id="why-title" eyebrow={c.why.eyebrow} title={c.why.title} />
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <figure>
            <OneSystemDiagram />
            <figcaption className="mt-2">
              <span className="block text-label font-medium text-text-secondary">
                {c.why.oneSystem}
              </span>
              <span className="text-caption text-text-muted">{c.why.oneSystemNote}</span>
            </figcaption>
          </figure>
          <figure>
            <CoreDiagram />
            <figcaption className="mt-2">
              <span className="block text-label font-medium text-text-primary">{c.why.core}</span>
              <span className="text-caption text-text-muted">{c.why.coreNote}</span>
            </figcaption>
          </figure>
        </Reveal>
        <Reveal stagger className="grid content-start gap-x-8 sm:grid-cols-2">
          {c.why.reasons.map((r, i) => (
            <RevealItem key={r.title} className="border-t border-border-soft py-5">
              <p className="text-caption text-text-muted tabular">0{i + 1}</p>
              <h3 className="mt-1 text-h3 text-text-primary">{r.title}</h3>
              <p className="mt-2 text-label text-text-secondary">{r.body}</p>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------------ */
/* Department stage — the selected department dominates                     */
/* ------------------------------------------------------------------------ */

export function DepartmentStage() {
  const c = useCopy(OVERVIEW);
  const s = useCopy(DEPT_SUMMARIES);
  const { href, locale } = useLocale();
  const pages = usePages();
  const reduce = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const d = pages[active]!;
  const id = d.id as DeptKey;
  const sum = s[id];
  const prev = pages[(active - 1 + pages.length) % pages.length]!;
  const next = pages[(active + 1) % pages.length]!;

  return (
    <Section labelledBy="stage-title">
      <SectionHead id="stage-title" eyebrow={c.stage.eyebrow} title={c.stage.title} />
      <div
        role="tablist"
        aria-label={c.stage.tabs}
        onKeyDown={(e) => tabKeys(pages.length, active, setActive, tabs)(e)}
        className="mt-10 grid grid-cols-3 gap-2 lg:grid-cols-6"
      >
        {pages.map((p, i) => {
          const on = i === active;
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`stage-tab-${p.id}`}
              aria-selected={on}
              aria-controls="stage-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              style={{ '--a': DEPT_ACCENT[p.id as DeptKey] } as CSSProperties}
              className={cn(
                'relative flex min-h-14 items-center gap-2 overflow-hidden rounded-xl border px-3 text-left transition-colors duration-300',
                on
                  ? 'border-[color-mix(in_oklab,var(--a)_55%,transparent)] bg-[color-mix(in_oklab,var(--a)_10%,transparent)] text-text-primary'
                  : 'border-border-soft bg-surface-base/60 text-text-secondary hover:border-border-strong hover:text-text-primary',
              )}
            >
              <Icon className="size-4 shrink-0 text-[var(--a)]" aria-hidden />
              <span className="text-label leading-tight font-medium">{p.name}</span>
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-3 bottom-0 h-0.5 origin-left rounded-full bg-[var(--a)] transition-transform duration-500',
                  on ? 'scale-x-100' : 'scale-x-0',
                )}
              />
            </button>
          );
        })}
      </div>

      <div
        id="stage-panel"
        role="tabpanel"
        aria-labelledby={`stage-tab-${d.id}`}
        style={{ '--a': DEPT_ACCENT[id] } as CSSProperties}
        className="relative mt-5 overflow-hidden rounded-[1.75rem] border border-border-soft bg-surface-base/70"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={id}
            initial={reduce ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: -16 }}
            transition={{ duration: 0.45, ease: EASE_CORE }}
            className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]"
          >
            <div className="relative aspect-[16/9] bg-surface-dark lg:aspect-auto lg:min-h-[26rem]">
              <img
                src={d.image.lg}
                alt=""
                width={960}
                height={540}
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-base via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-surface-base" />
            </div>
            <div className="relative flex flex-col p-6 sm:p-8">
              <p className="text-caption font-semibold tracking-[0.18em] text-[var(--a)] uppercase">
                {locale !== 'en' ? d.nameEn : 'CORE'}
              </p>
              <h3 className="mt-2 text-h2 text-text-primary">{d.name}</h3>
              <p className="mt-4 text-body-lg text-text-secondary">{sum.idea}</p>
              <p className="mt-6 text-caption font-medium text-text-muted">{c.stage.today}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {sum.today.map((t) => (
                  <li
                    key={t}
                    className="rounded-full border border-border-soft bg-surface-dark/60 px-3 py-1 text-caption text-text-secondary"
                  >
                    {t}
                  </li>
                ))}
              </ul>
              <Link
                to={href(deptPath(id))}
                className="group mt-8 inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--a)_50%,transparent)] px-5 text-label font-medium text-text-primary transition-colors hover:bg-[color-mix(in_oklab,var(--a)_12%,transparent)]"
              >
                {c.stage.open(d.name)}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
        {/* Adjacent departments, previewed at the edges. */}
        <div className="flex items-center justify-between gap-3 border-t border-border-soft p-3">
          {[
            {
              p: prev,
              label: c.stage.prev,
              to: (active - 1 + pages.length) % pages.length,
              Icon: ArrowLeft,
            },
            { p: next, label: c.stage.next, to: (active + 1) % pages.length, Icon: ArrowRight },
          ].map(({ p, label, to, Icon }, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setActive(to)}
              aria-label={`${label}: ${p.name}`}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-xl px-2 text-caption text-text-secondary transition-colors hover:bg-white/[0.04] hover:text-text-primary',
                i === 1 && 'flex-row-reverse text-right',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <img
                src={p.image.sm}
                alt=""
                width={400}
                height={225}
                loading="lazy"
                className="hidden h-9 w-16 rounded-md object-cover opacity-80 sm:block"
              />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------------ */
/* Index — six workspaces as an editorial list                              */
/* ------------------------------------------------------------------------ */

export function DepartmentIndex() {
  const c = useCopy(OVERVIEW);
  const s = useCopy(DEPT_SUMMARIES);
  const { href } = useLocale();
  const pages = usePages();
  return (
    <Section labelledBy="index-title">
      <SectionHead
        id="index-title"
        eyebrow={c.index.eyebrow}
        title={c.index.title}
        lead={c.index.lead}
      />
      <ol className="mt-10 border-t border-border-soft">
        {pages.map((d, i) => {
          const id = d.id as DeptKey;
          return (
            <li key={id} style={{ '--a': DEPT_ACCENT[id] } as CSSProperties}>
              <Link
                to={href(deptPath(id))}
                className="group grid gap-4 border-b border-border-soft py-5 transition-colors hover:bg-white/[0.02] sm:grid-cols-[3rem_9rem_minmax(0,1fr)_auto] sm:items-center sm:gap-6"
              >
                <span className="hidden text-caption text-text-muted tabular sm:block">
                  0{i + 1}
                </span>
                <img
                  src={d.image.sm}
                  alt=""
                  width={400}
                  height={225}
                  loading="lazy"
                  decoding="async"
                  className="hidden aspect-[16/9] w-36 rounded-lg object-cover sm:block"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-h3 text-text-primary">
                    <d.icon className="size-5 shrink-0 text-[var(--a)]" aria-hidden />
                    {d.name}
                  </span>
                  <span className="mt-2 grid gap-1 text-caption text-text-secondary sm:grid-cols-2 sm:gap-4">
                    <span>
                      <span className="text-text-muted">{c.index.takesIn} · </span>
                      {s[id].takesIn}
                    </span>
                    <span>
                      <span className="text-text-muted">{c.index.handsOn} · </span>
                      {s[id].handsOn}
                    </span>
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-label text-brand-glow">
                  {c.index.open}
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

/* ------------------------------------------------------------------------ */
/* Connected map                                                             */
/* ------------------------------------------------------------------------ */

const MAP_POS: Record<DeptKey, { x: number; y: number }> = {
  executive: { x: 300, y: 40 },
  sales: { x: 80, y: 130 },
  operations: { x: 80, y: 290 },
  warehouse: { x: 300, y: 380 },
  purchasing: { x: 520, y: 290 },
  accounting: { x: 520, y: 130 },
};

export function ConnectedMap() {
  const c = useCopy(OVERVIEW);
  const pages = usePages();
  const name = (id: string) => pages.find((p) => p.id === id)?.name ?? id;
  const reduce = usePrefersReducedMotion();
  return (
    <Section labelledBy="map-title">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <div>
          <SectionHead
            id="map-title"
            eyebrow={c.connected.eyebrow}
            title={c.connected.title}
            lead={c.connected.lead}
          />
          <ol className="mt-8 space-y-2">
            {c.connected.handoffs.map((h, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-panel border border-border-soft bg-surface-base/60 px-4 py-3"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-brand-glow/40 text-caption text-brand-glow tabular">
                  {i + 1}
                </span>
                <span className="text-label">
                  <span className="font-medium text-text-primary">
                    {h.from === 'all' ? '…' : name(h.from)} → {name(h.to)}
                  </span>
                  <span className="block text-caption text-text-secondary">{h.what}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <figure aria-label={c.connected.map} className="hidden sm:block">
          <svg aria-hidden viewBox="0 0 600 420" className="w-full">
            {c.connected.handoffs.map((h, i) => {
              const b = MAP_POS[h.to as DeptKey];
              const sources =
                h.from === 'all'
                  ? (['sales', 'operations', 'warehouse', 'purchasing', 'accounting'] as DeptKey[])
                  : [h.from as DeptKey];
              return sources.map((src) => {
                const a = MAP_POS[src];
                const d = `M ${a.x} ${a.y} Q 300 210 ${b.x} ${b.y}`;
                return (
                  <g key={`${i}-${src}`}>
                    <path
                      d={d}
                      fill="none"
                      stroke={DEPT_ACCENT[src]}
                      strokeOpacity={h.from === 'all' ? 0.18 : 0.45}
                      strokeWidth="1.5"
                    />
                    {!reduce && h.from !== 'all' && (
                      <circle r="3.5" fill={DEPT_ACCENT[src]}>
                        <animateMotion dur={`${4 + i * 0.6}s`} repeatCount="indefinite" path={d} />
                      </circle>
                    )}
                  </g>
                );
              });
            })}
            <circle
              cx="300"
              cy="210"
              r="34"
              fill="var(--color-surface-raised)"
              stroke="var(--color-brand-glow)"
              strokeOpacity="0.6"
            />
            <text
              x="300"
              y="215"
              textAnchor="middle"
              fontSize="13"
              letterSpacing="3"
              fill="var(--color-brand-glow)"
            >
              CORE
            </text>
            {DEPT_PAGES.map((id) => {
              const p = MAP_POS[id];
              return (
                <g key={id}>
                  <rect
                    x={p.x - 62}
                    y={p.y - 17}
                    width="124"
                    height="34"
                    rx="17"
                    fill="var(--color-surface-base)"
                    stroke={DEPT_ACCENT[id]}
                    strokeOpacity="0.7"
                  />
                  <text
                    x={p.x}
                    y={p.y + 5}
                    textAnchor="middle"
                    fontSize="13"
                    fill="var(--color-text-primary)"
                  >
                    {name(id)}
                  </text>
                </g>
              );
            })}
            {c.connected.handoffs.map((h, i) => {
              if (h.from === 'all') return null;
              const a = MAP_POS[h.from as DeptKey];
              const b = MAP_POS[h.to as DeptKey];
              const mx = 0.25 * a.x + 0.5 * 300 + 0.25 * b.x;
              const my = 0.25 * a.y + 0.5 * 210 + 0.25 * b.y;
              return (
                <g key={`n${i}`}>
                  <circle
                    cx={mx}
                    cy={my}
                    r="10"
                    fill="var(--color-surface-dark)"
                    stroke="var(--color-brand-glow)"
                    strokeOpacity="0.5"
                  />
                  <text
                    x={mx}
                    y={my + 4}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--color-brand-glow)"
                  >
                    {i + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </figure>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------------ */
/* Employee · Manager · Executive                                            */
/* ------------------------------------------------------------------------ */

export function AltitudeModel() {
  const c = useCopy(OVERVIEW);
  const levels = [...c.altitude.levels].reverse(); // executive on top
  return (
    <Section labelledBy="altitude-title">
      <SectionHead
        id="altitude-title"
        eyebrow={c.altitude.eyebrow}
        title={c.altitude.title}
        lead={c.altitude.lead}
        align="center"
      />
      <Reveal stagger className="mx-auto mt-12 flex max-w-4xl flex-col items-center gap-3">
        {levels.map((l, i) => (
          <RevealItem
            key={l.name}
            className={cn(
              'w-full rounded-card border p-5 sm:p-6',
              i === 0 && 'border-brand-glow/40 bg-brand-primary/[0.07] sm:w-[72%]',
              i === 1 && 'border-border-strong bg-surface-raised/70 sm:w-[86%]',
              i === 2 && 'border-border-soft bg-surface-base/70',
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p>
                <span className="block text-h3 text-text-primary">{l.name}</span>
                <span className="text-caption text-text-muted">{l.sees}</span>
              </p>
              <ul className="flex flex-wrap gap-2">
                {l.items.map((it) => (
                  <li
                    key={it}
                    className="rounded-full border border-border-soft bg-surface-dark/50 px-3 py-1 text-caption text-text-secondary"
                  >
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          </RevealItem>
        ))}
      </Reveal>
    </Section>
  );
}
