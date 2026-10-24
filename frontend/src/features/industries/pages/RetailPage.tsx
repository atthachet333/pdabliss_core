import { motion } from 'framer-motion';
import { ArrowRight, Store, Warehouse } from 'lucide-react';
import { useRef, useState } from 'react';
import { Chapter, Frame, Kicker, Stage } from '@/components/editorial/Layout';
import { tabKeys } from '@/features/departments/tabs';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { RETAIL } from '../copy/retail';
import { INDUSTRIES_SUMMARY } from '../copy/summary';
import {
  BRANCH_CHECKS,
  BRANCHES,
  INDUSTRIES,
  worstHealth,
  type BranchId,
  type Health,
} from '../model';
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

const ID = 'retail';
const IND = INDUSTRIES[ID];

const HEALTH_STROKE: Record<Health, string> = {
  ok: 'var(--color-brand-glow)',
  attention: 'var(--color-warning)',
  blocked: 'var(--color-danger)',
};

/* Hero: a branch network around the DC -------------------------------- */

const SPOT: Record<BranchId, { x: number; y: number }> = {
  b1: { x: 130, y: 90 },
  b2: { x: 455, y: 70 },
  b3: { x: 80, y: 260 },
  b4: { x: 505, y: 280 },
  b5: { x: 290, y: 40 },
  b6: { x: 300, y: 335 },
};
const DC = { x: 300, y: 190 };

function BranchNetwork() {
  const c = useCopy(RETAIL).signature;
  const reduce = usePrefersReducedMotion();
  return (
    <svg
      aria-hidden
      viewBox="0 0 600 380"
      className="w-full overflow-visible"
      data-motif="branches"
    >
      {BRANCHES.map((b) => (
        <line
          key={b.id}
          x1={DC.x}
          y1={DC.y}
          x2={SPOT[b.id].x}
          y2={SPOT[b.id].y}
          stroke="var(--color-border-strong)"
        />
      ))}
      {/* A branch-to-branch transfer */}
      <path
        d={`M ${SPOT.b1.x} ${SPOT.b1.y} Q 60 170 ${SPOT.b3.x} ${SPOT.b3.y}`}
        fill="none"
        stroke="var(--color-warning)"
        strokeDasharray="4 5"
      />
      <rect
        x={DC.x - 40}
        y={DC.y - 26}
        width="80"
        height="52"
        rx="12"
        fill="var(--color-surface-raised)"
        stroke="var(--color-ws-warehouse)"
        strokeWidth="2"
      />
      <text
        x={DC.x}
        y={DC.y + 5}
        textAnchor="middle"
        fontSize="12"
        fill="var(--color-text-primary)"
      >
        {c.dc}
      </text>
      {BRANCHES.map((b, i) => {
        const p = SPOT[b.id];
        const h = worstHealth(b.health);
        return (
          <motion.g
            key={b.id}
            {...(reduce
              ? {}
              : {
                  initial: { opacity: 0, scale: 0.6 },
                  animate: { opacity: 1, scale: 1 },
                  transition: { delay: 0.2 + i * 0.1, duration: 0.5, ease: EASE_CORE },
                })}
            style={{ transformOrigin: `${p.x}px ${p.y}px` }}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r="22"
              fill="var(--color-surface-base)"
              stroke={HEALTH_STROKE[h]}
              strokeWidth="2"
              strokeDasharray={h === 'ok' ? undefined : '4 3'}
            />
            <path
              d={`M ${p.x - 9} ${p.y + 6} V ${p.y - 3} L ${p.x} ${p.y - 9} L ${p.x + 9} ${p.y - 3} V ${p.y + 6} Z`}
              fill="none"
              stroke="var(--color-text-secondary)"
              strokeWidth="1.4"
            />
            <text
              x={p.x}
              y={p.y + 40}
              textAnchor="middle"
              fontSize="12"
              fill="var(--color-text-secondary)"
            >
              {c.branches[b.id]}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}

function Hero() {
  const c = useCopy(RETAIL);
  return (
    <section
      aria-labelledby="industry-title"
      className="relative isolate overflow-hidden"
      data-industry-hero={ID}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_60%_at_28%_50%,rgb(62_224_180/0.08),transparent_70%)]"
      />
      <Frame width="wide" className="pt-24 pb-16 sm:pt-28 lg:pt-32 lg:pb-24">
        <BackLink />
        <div className="mt-6 grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <figure aria-label={c.hero.visual} className="order-2 lg:order-1">
            <div className="hidden md:block">
              <BranchNetwork />
            </div>
            <ul className="grid grid-cols-2 gap-2 md:hidden">
              {BRANCHES.map((b) => {
                const h = worstHealth(b.health);
                return (
                  <li
                    key={b.id}
                    className="flex min-h-12 items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-3"
                  >
                    <span className="text-caption text-text-primary">
                      {c.signature.branches[b.id]}
                    </span>
                    <ToneTag tone={h} label={c.signature.health[h]} />
                  </li>
                );
              })}
            </ul>
          </figure>
          <div className="order-1 lg:order-2">
            <Kicker tone="clear">{c.hero.eyebrow}</Kicker>
            <PageTitle className="mt-5">{c.hero.title}</PageTitle>
            <p className="mt-7 text-body-lg text-text-secondary">{c.hero.lead}</p>
          </div>
        </div>
      </Frame>
    </section>
  );
}

/* Signature: branch health -------------------------------------------- */

function BranchHealth() {
  const c = useCopy(RETAIL).signature;
  const [index, setIndex] = useState(3);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const branch = BRANCHES[index]!;
  const issues = BRANCH_CHECKS.filter((k) => branch.health[k] !== 'ok');
  return (
    <Chapter id="branch-health" labelledBy="branch-health-title" plane="deep" space="lg">
      <Frame width="wide">
        <Head id="branch-health-title" eyebrow={c.eyebrow} title={c.title} lead={c.lead} />
        <div className="mt-12 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]">
          <Stage glow="clear" grid={false} className="p-3 sm:p-5">
            <div
              role="radiogroup"
              aria-label={c.choose}
              onKeyDown={(e) => tabKeys(BRANCHES.length, index, setIndex, refs)(e)}
              className="overflow-x-auto"
            >
              <table className="w-full min-w-[34rem] text-left" data-branch-matrix>
                <caption className="sr-only">{c.title}</caption>
                <thead>
                  <tr className="text-caption text-text-muted">
                    <th scope="col" className="px-3 py-3 font-normal">
                      {c.choose}
                    </th>
                    {BRANCH_CHECKS.map((k) => (
                      <th key={k} scope="col" className="px-2 py-3 text-center font-normal">
                        {c.checks[k]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BRANCHES.map((b, i) => {
                    const on = i === index;
                    return (
                      <tr
                        key={b.id}
                        data-branch={b.id}
                        className={cn(
                          'border-t border-white/[0.05]',
                          on && 'bg-brand-primary/[0.08]',
                        )}
                      >
                        <th scope="row" className="px-1 py-1 font-normal">
                          <button
                            ref={(el) => {
                              refs.current[i] = el;
                            }}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            tabIndex={on ? 0 : -1}
                            onClick={() => setIndex(i)}
                            className={cn(
                              'flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-label',
                              on
                                ? 'text-text-primary'
                                : 'text-text-secondary hover:text-text-primary',
                            )}
                          >
                            <Store aria-hidden className="size-4 shrink-0" />
                            {c.branches[b.id]}
                          </button>
                        </th>
                        {BRANCH_CHECKS.map((k) => (
                          <td
                            key={k}
                            className="px-2 py-1 text-center"
                            data-check={k}
                            data-health={b.health[k]}
                          >
                            <ToneTag
                              tone={b.health[k]}
                              label={c.health[b.health[k]]}
                              compact
                              className="justify-center"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Stage>
          <div
            aria-live="polite"
            data-branch-detail={branch.id}
            className="rounded-[2rem] bg-white/[0.03] p-6 sm:p-8"
          >
            <p className="flex items-center gap-2 text-h3 font-semibold text-text-primary">
              <Store aria-hidden className="size-5 text-brand-glow" />
              {c.branches[branch.id]}
            </p>
            {issues.length ? (
              <ul className="mt-6 space-y-4">
                {issues.map((k) => (
                  <li key={k} data-issue={k}>
                    <ToneTag
                      tone={branch.health[k]}
                      label={`${c.checks[k]} · ${c.health[branch.health[k]]}`}
                    />
                    <p className="mt-1 text-label text-text-secondary">{c.actions[k]}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6">
                <ToneTag tone="ok" label={c.allGood} className="text-label" />
              </p>
            )}
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

/* Example workflow: the replenishment loop ---------------------------- */

function Loop() {
  const c = useCopy(RETAIL);
  const s = useCopy(INDUSTRIES_SUMMARY).industries[ID];
  const name = useDeptName();
  const n = IND.workflow.length;
  const at = (i: number) => {
    const a = (-90 + (i * 360) / n) * (Math.PI / 180);
    return { x: 50 + 40 * Math.cos(a), y: 50 + 40 * Math.sin(a) };
  };
  return (
    <Chapter id="workflow" labelledBy="workflow-title" space="lg">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-center">
          <div>
            <Head id="workflow-title" title={c.workflow.title} />
            <ExampleLabel className="mt-6" />
          </div>
          <div>
            <div
              aria-hidden
              className="relative mx-auto hidden aspect-square max-w-[34rem] md:block"
            >
              <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="var(--color-brand-glow)"
                  strokeOpacity="0.35"
                  strokeWidth="0.4"
                  strokeDasharray="1 1.5"
                />
              </svg>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <Warehouse className="mx-auto size-6 text-brand-glow" />
                <p className="mt-2 text-label font-semibold text-text-primary">
                  {c.signature.loop}
                </p>
              </div>
              {IND.workflow.map((w, i) => {
                const p = at(i);
                const stuck = w.id === IND.stuckAt;
                return (
                  <div
                    key={w.id}
                    className={cn(
                      'absolute w-36 -translate-x-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-center',
                      stuck
                        ? 'bg-[rgb(245_184_75/0.14)] shadow-[inset_0_0_0_1px_rgb(245_184_75/0.4)]'
                        : 'bg-surface-base shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)]',
                    )}
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  >
                    <p
                      className={cn(
                        'text-caption font-semibold',
                        stuck ? 'text-warning' : 'text-text-primary',
                      )}
                    >
                      {s.steps[w.id]}
                    </p>
                  </div>
                );
              })}
            </div>
            <ol
              data-workflow={ID}
              className="space-y-2 md:mt-10 md:grid md:grid-cols-2 md:space-y-0 md:gap-x-8 md:gap-y-3"
            >
              {IND.workflow.map((w, i) => (
                <li key={w.id} data-step={w.id} className="flex gap-3">
                  <span className="text-caption text-text-muted tabular">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>
                    <span className="flex items-center gap-1.5 text-label font-semibold text-text-primary">
                      <DeptDot id={w.dept} className="size-1.5" />
                      {s.steps[w.id]}
                      <span className="text-caption font-normal text-text-muted">
                        · {name(w.dept)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-caption text-text-secondary">
                      {c.workflow.notes[w.id]}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

/* Page ---------------------------------------------------------------- */

export default function RetailPage() {
  const c = useIndustryPage(RETAIL);
  const s = useCopy(INDUSTRIES_SUMMARY);
  const name = useDeptName();
  return (
    <>
      <Hero />

      {/* The boundary comes first: operations, not checkout */}
      <Chapter id="boundary" labelledBy="boundary-title" space="sm">
        <Frame width="base">
          <h2 id="boundary-title" className="sr-only">
            {s.common.boundaries.pos.title}
          </h2>
          <Boundaries id={ID} prominent />
        </Frame>
      </Chapter>

      <Chapter id="reality" labelledBy="reality-title" plane="navy">
        <Frame width="wide">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <Head id="reality-title" title={c.reality.title} lead={c.reality.lead} />
            <dl className="space-y-6">
              {c.reality.points.map((pt) => (
                <div key={pt.title} className="border-t border-border-soft pt-5">
                  <dt className="text-body font-semibold text-text-primary">{pt.title}</dt>
                  <dd className="mt-1 text-label text-text-secondary">{pt.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Frame>
      </Chapter>

      <BranchHealth />
      <Loop />

      <Chapter id="friction" labelledBy="friction-title" plane="grid">
        <Frame width="wide">
          <Head id="friction-title" title={c.frictions.title} />
          <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-frictions>
            {c.frictions.items.map((f) => (
              <li
                key={f}
                className="rounded-2xl bg-[rgb(245_184_75/0.05)] px-5 py-4 text-label text-text-primary shadow-[inset_0_0_0_1px_rgb(245_184_75/0.12)]"
              >
                {f}
              </li>
            ))}
          </ul>
        </Frame>
      </Chapter>

      <Chapter id="departments" labelledBy="departments-title">
        <Frame width="wide">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <Head id="departments-title" title={c.departments.title} />
              <ul className="mt-8 space-y-4" data-departments>
                {IND.departments.map((d) => (
                  <li key={d} data-dept={d} className="flex gap-3">
                    <DeptDot id={d} className="mt-2" />
                    <p className="text-label text-text-secondary">
                      <span className="block text-body font-semibold text-text-primary">
                        {name(d)}
                      </span>
                      {c.departments.roles[d]}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <Stage glow="executive" grid={false} className="p-6 sm:p-8">
              <h3 className="text-h3 text-text-primary">{c.signals.title}</h3>
              <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2" data-signals={ID}>
                {IND.signals.map((sg) => (
                  <li key={sg.id} data-signal={sg.id}>
                    <ToneTag tone={sg.tone} label={s.industries[ID].signals[sg.id]!} />
                    <p className="mt-1 text-caption text-text-secondary">
                      {c.signals.notes[sg.id]}
                    </p>
                  </li>
                ))}
              </ul>
            </Stage>
          </div>
        </Frame>
      </Chapter>

      <Chapter id="information" labelledBy="information-title" plane="navy">
        <Frame width="wide">
          <Head id="information-title" title={c.information.title} />
          <dl
            className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-[1.5rem] bg-white/[0.05] sm:grid-cols-2 lg:grid-cols-5"
            data-information
          >
            {c.information.items.map((it) => (
              <div key={it.label} className="bg-[rgb(9_19_28)] px-5 py-5">
                <dt className="text-label font-semibold text-text-primary">{it.label}</dt>
                <dd className="mt-1 text-caption text-text-secondary">{it.why}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-20">
            <Head id="fit-title" title={c.fit.title} lead={c.fit.lead} />
            <PrincipleFit id={ID} variant="ledger" className="mt-8" />
          </div>
          <Limits
            notReplace={c.notReplace}
            custom={c.custom}
            className="mt-14 border-t border-border-soft pt-12"
          />
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
