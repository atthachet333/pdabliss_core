import { motion } from 'framer-motion';
import { ArrowRight, Diamond, GitFork, Hourglass } from 'lucide-react';
import { useState } from 'react';
import { Chapter, Frame, Kicker, Stage } from '@/components/editorial/Layout';
import type { DeptKey } from '@/features/departments/catalog';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { PROJECTS } from '../copy/projects';
import { INDUSTRIES_SUMMARY } from '../copy/summary';
import { downstream, INDUSTRIES, MILESTONES, PHASES, type MilestoneId } from '../model';
import {
  BackLink,
  Boundaries,
  DeptDot,
  Ending,
  ExampleLabel,
  Head,
  Limits,
  PageTitle,
  PrincipleFit,
  RelatedLinks,
  ToneTag,
} from '../parts';
import { useDeptName, useIndustryPage } from '../useIndustryMeta';

const ID = 'projects';
const IND = INDUSTRIES[ID];

/* Hero: phases as a rising architecture of milestones ----------------- */

const BARS = [
  { phase: 'plan', x1: 20, x2: 190, y: 70 },
  { phase: 'procure', x1: 150, x2: 300, y: 130, late: 60 },
  { phase: 'build', x1: 300, x2: 520, y: 190 },
  { phase: 'handover', x1: 480, x2: 640, y: 250 },
] as const;

function MilestoneArchitecture() {
  const c = useCopy(PROJECTS).signature;
  const reduce = usePrefersReducedMotion();
  return (
    <svg
      aria-hidden
      viewBox="0 0 680 300"
      className="w-full overflow-visible"
      data-motif="milestones"
    >
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <line
          key={i}
          x1={20 + i * 103}
          y1="20"
          x2={20 + i * 103}
          y2="290"
          stroke="var(--color-border-soft)"
        />
      ))}
      {BARS.map((b, i) => (
        <motion.g
          key={b.phase}
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, x: -12 },
                animate: { opacity: 1, x: 0 },
                transition: { delay: 0.2 + i * 0.2, duration: 0.6, ease: EASE_CORE },
              })}
        >
          <text x={b.x1} y={b.y - 16} fontSize="12" fill="var(--color-text-secondary)">
            {c.phases[b.phase]}
          </text>
          <rect
            x={b.x1}
            y={b.y - 7}
            width={b.x2 - b.x1}
            height="14"
            rx="7"
            fill="rgb(62 240 192 / 0.16)"
            stroke="var(--color-brand-glow)"
            strokeOpacity="0.5"
          />
          {'late' in b && (
            <rect
              x={b.x2}
              y={b.y - 7}
              width={b.late}
              height="14"
              rx="7"
              fill="rgb(245 184 75 / 0.1)"
              stroke="var(--color-warning)"
              strokeDasharray="4 4"
            />
          )}
          <path
            d={`M ${b.x2 + ('late' in b ? b.late : 0)} ${b.y - 9} l 9 9 -9 9 -9 -9 z`}
            fill="var(--color-surface-dark)"
            stroke={'late' in b ? 'var(--color-warning)' : 'var(--color-brand-glow)'}
            strokeWidth="1.6"
          />
        </motion.g>
      ))}
      {/* Dependencies */}
      <path
        d="M 199 70 C 230 70, 140 130, 150 123"
        fill="none"
        stroke="var(--color-text-muted)"
        strokeDasharray="3 4"
      />
      <path
        d="M 369 130 C 400 130, 300 190, 300 183"
        fill="none"
        stroke="var(--color-warning)"
        strokeDasharray="3 4"
      />
      <path
        d="M 529 190 C 560 190, 470 250, 480 243"
        fill="none"
        stroke="var(--color-text-muted)"
        strokeDasharray="3 4"
      />
      <text x="372" y="122" fontSize="11" fill="var(--color-warning)">
        {c.impacted}
      </text>
    </svg>
  );
}

function Hero() {
  const c = useCopy(PROJECTS);
  return (
    <section
      aria-labelledby="industry-title"
      className="relative isolate overflow-hidden"
      data-industry-hero={ID}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[repeating-linear-gradient(90deg,rgb(190_235_222/0.04)_0,rgb(190_235_222/0.04)_1px,transparent_1px,transparent_96px)]"
      />
      <Frame width="wide" className="pt-24 pb-16 sm:pt-28 lg:pt-32 lg:pb-20">
        <BackLink />
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:items-end lg:gap-16">
          <div>
            <Kicker tone="clear">{c.hero.eyebrow}</Kicker>
            <PageTitle className="mt-5">{c.hero.title}</PageTitle>
          </div>
          <p className="text-body-lg text-text-secondary">{c.hero.lead}</p>
        </div>
        <figure aria-label={c.hero.visual} className="mt-14">
          <div className="mx-auto hidden max-w-5xl md:block">
            <MilestoneArchitecture />
          </div>
          {/* Phones: the phases as offset bars */}
          <ol className="space-y-2 md:hidden">
            {BARS.map((b, i) => (
              <li
                key={b.phase}
                style={{ ['--in' as string]: `${i * 14}%` }}
                className="ml-[var(--in)]"
              >
                <span
                  className={cn(
                    'flex min-h-10 items-center rounded-full px-4 text-caption',
                    'late' in b
                      ? 'bg-[rgb(245_184_75/0.12)] text-warning shadow-[inset_0_0_0_1px_rgb(245_184_75/0.35)]'
                      : 'bg-brand-primary/12 text-text-primary',
                  )}
                >
                  {c.signature.phases[b.phase]}
                  {'late' in b && ` · ${c.signature.impacted}`}
                </span>
              </li>
            ))}
          </ol>
        </figure>
      </Frame>
    </section>
  );
}

/* Signature: the dependency map --------------------------------------- */

const POS: Record<MilestoneId, { x: number; y: number }> = {
  design: { x: 70, y: 130 },
  materials: { x: 230, y: 70 },
  install: { x: 390, y: 70 },
  systems: { x: 390, y: 200 },
  inspection: { x: 545, y: 130 },
  acceptance: { x: 660, y: 130 },
};

function DependencyMap() {
  const c = useCopy(PROJECTS).signature;
  const [late, setLate] = useState(false);
  const hit = new Set<MilestoneId>(late ? downstream('materials') : []);
  return (
    <Chapter id="dependencies" labelledBy="dependencies-title" plane="deep" space="lg">
      <Frame width="wide">
        <Head id="dependencies-title" eyebrow={c.eyebrow} title={c.title} lead={c.lead} />
        <Stage glow={late ? 'warm' : 'clear'} className="mt-12 p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              role="switch"
              aria-checked={late}
              onClick={() => setLate((v) => !v)}
              data-late-toggle
              className={cn(
                'inline-flex min-h-11 items-center gap-3 rounded-full px-4 text-label transition-colors',
                late
                  ? 'bg-[rgb(245_184_75/0.14)] text-warning'
                  : 'bg-white/[0.05] text-text-secondary hover:text-text-primary',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'relative h-5 w-9 rounded-full transition-colors',
                  late ? 'bg-warning/60' : 'bg-white/15',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 size-4 rounded-full bg-text-primary transition-[left]',
                    late ? 'left-[1.125rem]' : 'left-0.5',
                  )}
                />
              </span>
              {c.toggle}
            </button>
            <p aria-live="polite" className="text-label text-text-secondary" data-impact-summary>
              {late ? c.summaryLate : c.summaryCalm}
            </p>
          </div>
          {/* Wide: the graph */}
          <svg viewBox="0 0 730 260" className="mt-6 hidden w-full md:block" aria-hidden>
            {MILESTONES.flatMap((m) =>
              m.after.map((a) => {
                const from = POS[a as MilestoneId];
                const to = POS[m.id];
                const warm = hit.has(m.id) && (hit.has(a as MilestoneId) || a === 'materials');
                return (
                  <path
                    key={`${a}-${m.id}`}
                    d={`M ${from.x + 34} ${from.y} C ${(from.x + to.x) / 2} ${from.y}, ${(from.x + to.x) / 2} ${to.y}, ${to.x - 34} ${to.y}`}
                    fill="none"
                    stroke={warm ? 'var(--color-warning)' : 'var(--color-brand-glow)'}
                    strokeOpacity={warm ? 0.8 : 0.4}
                    strokeWidth="1.6"
                    strokeDasharray={warm ? '5 5' : undefined}
                  />
                );
              }),
            )}
            {MILESTONES.map((m) => {
              const p = POS[m.id];
              const h = hit.has(m.id);
              return (
                <g key={m.id}>
                  <path
                    d={`M ${p.x} ${p.y - 16} l 16 16 -16 16 -16 -16 z`}
                    fill="var(--color-surface-dark)"
                    stroke={h ? 'var(--color-warning)' : 'var(--color-brand-glow)'}
                    strokeWidth="1.8"
                  />
                  <text
                    x={p.x}
                    y={p.y + 36}
                    textAnchor="middle"
                    fontSize="12"
                    fill={h ? 'var(--color-warning)' : 'var(--color-text-secondary)'}
                  >
                    {c.milestones[m.id]}
                  </text>
                </g>
              );
            })}
          </svg>
          {/* Every width: the same state as words */}
          <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3" data-milestones>
            {MILESTONES.map((m) => {
              const h = hit.has(m.id);
              return (
                <li
                  key={m.id}
                  data-milestone={m.id}
                  data-impacted={h}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-4 py-3"
                >
                  <span className="flex items-center gap-2 text-label text-text-primary">
                    <Diamond aria-hidden className="size-3.5 text-text-muted" />
                    {c.milestones[m.id]}
                  </span>
                  <ToneTag tone={h ? 'attention' : 'ok'} label={h ? c.impacted : c.onTrack} />
                </li>
              );
            })}
          </ul>
        </Stage>
      </Frame>
    </Chapter>
  );
}

/* Example workflow: a rising staircase with gates --------------------- */

const GATES = new Set(['milestone', 'acceptance']);

function Staircase() {
  const c = useCopy(PROJECTS);
  const s = useCopy(INDUSTRIES_SUMMARY).industries[ID];
  const name = useDeptName();
  const n = IND.workflow.length;
  return (
    <Chapter id="workflow" labelledBy="workflow-title" space="lg">
      <Frame width="full">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)] lg:items-end">
          <Head id="workflow-title" title={c.workflow.title} />
          <ExampleLabel />
        </div>
        <ol
          data-workflow={ID}
          className="mt-14 grid grid-cols-1 gap-2 md:h-[26rem] md:grid-cols-8 md:items-end"
        >
          {IND.workflow.map((w, i) => {
            const stuck = w.id === IND.stuckAt;
            const gate = GATES.has(w.id);
            return (
              <li
                key={w.id}
                data-step={w.id}
                style={{ ['--h' as string]: `${30 + (i / (n - 1)) * 70}%` }}
                className={cn(
                  'relative flex flex-col justify-end rounded-2xl px-4 py-4 md:h-[var(--h)] md:min-h-fit',
                  stuck
                    ? 'bg-[linear-gradient(180deg,rgb(245_184_75/0.18),rgb(245_184_75/0.04))] shadow-[inset_0_0_0_1px_rgb(245_184_75/0.35)]'
                    : 'bg-[linear-gradient(180deg,rgb(25_195_154/0.1),rgb(25_195_154/0.02))]',
                )}
              >
                {gate && (
                  <span
                    aria-hidden
                    className="absolute -top-2.5 left-4 flex size-5 rotate-45 items-center justify-center bg-surface-dark shadow-[inset_0_0_0_1.5px_var(--color-brand-glow)]"
                  />
                )}
                <span className="text-caption text-text-muted tabular">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="mt-1 text-label font-semibold text-text-primary">
                  {s.steps[w.id]}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-caption text-text-secondary">
                  <DeptDot id={w.dept} className="size-1.5" />
                  {name(w.dept)}
                </span>
                <span className="mt-2 text-caption text-text-muted">{c.workflow.notes[w.id]}</span>
              </li>
            );
          })}
        </ol>
      </Frame>
    </Chapter>
  );
}

/* Departments by phase ------------------------------------------------ */

const ACTIVE: Partial<Record<DeptKey, readonly (typeof PHASES)[number][]>> = {
  operations: ['plan', 'procure', 'build', 'handover'],
  sales: ['plan', 'handover'],
  purchasing: ['procure', 'build'],
  accounting: ['handover'],
  executive: ['plan', 'handover'],
};

/* Page ---------------------------------------------------------------- */

export default function ProjectsPage() {
  const c = useIndustryPage(PROJECTS);
  const s = useCopy(INDUSTRIES_SUMMARY);
  const name = useDeptName();
  return (
    <>
      <Hero />

      {/* Reality as staggered phases */}
      <Chapter id="reality" labelledBy="reality-title" plane="navy">
        <Frame width="wide">
          <Head id="reality-title" title={c.reality.title} lead={c.reality.lead} />
          <ol className="mt-12 space-y-3">
            {c.reality.points.map((pt, i) => (
              <li
                key={pt.title}
                style={{ ['--in' as string]: `${i * 12}%` }}
                className="rounded-2xl bg-white/[0.035] px-6 py-5 md:ml-[var(--in)] md:max-w-[70%]"
              >
                <p className="text-body font-semibold text-text-primary">{pt.title}</p>
                <p className="mt-1 text-label text-text-secondary">{pt.body}</p>
              </li>
            ))}
          </ol>
        </Frame>
      </Chapter>

      <DependencyMap />
      <Staircase />

      {/* Frictions + who is waiting for whom */}
      <Chapter id="friction" labelledBy="friction-title" plane="grid">
        <Frame width="wide">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-16">
            <div>
              <Head id="friction-title" title={c.frictions.title} />
              <ul className="mt-8 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2" data-frictions>
                {c.frictions.items.map((f) => (
                  <li key={f} className="flex gap-3 text-label text-text-secondary">
                    <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <Stage glow="warm" grid={false} className="p-6 sm:p-8">
              <p className="flex items-center gap-2 text-caption font-semibold text-warning">
                <GitFork aria-hidden className="size-3.5" />
                {c.signature.waitChain.title}
              </p>
              <ol className="mt-5 space-y-2" data-wait-chain>
                {c.signature.waitChain.items.map((w, i) => (
                  <li
                    key={w}
                    style={{ ['--in' as string]: `${i * 1.25}rem` }}
                    className="ml-[var(--in)] rounded-xl bg-white/[0.04] px-4 py-3 text-label text-text-primary"
                  >
                    {w}
                  </li>
                ))}
              </ol>
            </Stage>
          </div>
        </Frame>
      </Chapter>

      {/* Departments × phases */}
      <Chapter id="departments" labelledBy="departments-title">
        <Frame width="wide">
          <Head id="departments-title" title={c.departments.title} />
          <div className="mt-10 hidden md:block">
            <table className="w-full text-left" data-departments>
              <caption className="sr-only">{c.signature.phaseMatrix}</caption>
              <thead>
                <tr className="text-caption text-text-muted">
                  <th scope="col" className="pb-3 font-normal">
                    <span className="sr-only">{s.common.departments}</span>
                  </th>
                  {PHASES.map((ph) => (
                    <th key={ph} scope="col" className="pb-3 text-center font-normal">
                      {c.signature.phases[ph]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {IND.departments.map((d) => (
                  <tr key={d} data-dept={d}>
                    <th scope="row" className="py-4 pr-4 align-top font-normal">
                      <span className="flex items-center gap-2 text-label font-semibold text-text-primary">
                        <DeptDot id={d} />
                        {name(d)}
                      </span>
                      <span className="mt-1 block max-w-xs text-caption text-text-secondary">
                        {c.departments.roles[d]}
                      </span>
                    </th>
                    {PHASES.map((ph) => {
                      const on = ACTIVE[d]?.includes(ph) ?? false;
                      return (
                        <td key={ph} className="py-4 text-center align-top">
                          <span
                            className={cn(
                              'inline-block size-3 rounded-full',
                              on
                                ? 'bg-brand-glow shadow-[0_0_10px_rgb(62_240_192/0.5)]'
                                : 'bg-white/10',
                            )}
                          />
                          <span className="sr-only">{on ? '✓' : '—'}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Phones: each department with the phases it works in */}
          <ul className="mt-8 space-y-3 md:hidden">
            {IND.departments.map((d) => (
              <li key={d} className="rounded-2xl bg-white/[0.03] px-5 py-4">
                <p className="flex items-center gap-2 text-label font-semibold text-text-primary">
                  <DeptDot id={d} />
                  {name(d)}
                </p>
                <p className="mt-1 text-caption text-text-secondary">{c.departments.roles[d]}</p>
                <p className="mt-3 flex flex-wrap gap-1.5">
                  {(ACTIVE[d] ?? []).map((ph) => (
                    <span
                      key={ph}
                      className="rounded-full bg-brand-primary/12 px-2.5 py-1 text-caption text-brand-soft"
                    >
                      {c.signature.phases[ph]}
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </Frame>
      </Chapter>

      {/* Signals and information */}
      <Chapter id="signals" labelledBy="signals-title" plane="navy">
        <Frame width="wide">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <Head id="signals-title" title={c.signals.title} />
              <ul className="mt-8 divide-y divide-border-soft" data-signals={ID}>
                {IND.signals.map((sg) => (
                  <li
                    key={sg.id}
                    data-signal={sg.id}
                    className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6"
                  >
                    <ToneTag
                      tone={sg.tone}
                      label={s.industries[ID].signals[sg.id]!}
                      className="sm:w-48 sm:shrink-0"
                    />
                    <p className="text-label text-text-secondary">{c.signals.notes[sg.id]}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Kicker tone="muted">{c.information.title}</Kicker>
              <dl className="mt-6 space-y-4" data-information>
                {c.information.items.map((it) => (
                  <div key={it.label} className="rounded-xl bg-white/[0.03] px-5 py-4">
                    <dt className="text-label font-semibold text-text-primary">{it.label}</dt>
                    <dd className="mt-0.5 text-caption text-text-secondary">{it.why}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Frame>
      </Chapter>

      <Chapter id="fit" labelledBy="fit-title">
        <Frame width="wide">
          <Head id="fit-title" title={c.fit.title} lead={c.fit.lead} />
          <PrincipleFit id={ID} className="mt-12" />
          <div className="mt-16 grid grid-cols-1 gap-12 border-t border-border-soft pt-12 lg:grid-cols-2">
            <Boundaries id={ID} />
            <Limits notReplace={c.notReplace} custom={c.custom} />
          </div>
        </Frame>
      </Chapter>

      <Chapter labelledBy="next-title" plane="clear" space="lg" className="pb-32 sm:pb-40">
        <Frame width="wide">
          <RelatedLinks id={ID} />
          <div className="mt-20">
            <Ending id={ID}>
              <h2
                id="next-title"
                className="flex items-center justify-center gap-3 text-h2 text-text-primary"
              >
                <ArrowRight aria-hidden className="size-6 text-brand-glow" />
                {s.cta.title}
              </h2>
            </Ending>
          </div>
        </Frame>
      </Chapter>
    </>
  );
}
