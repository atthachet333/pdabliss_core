import { Building2, Check, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { Chapter, Frame, Kicker, Stage } from '@/components/editorial/Layout';
import { DEPT_PAGES } from '@/features/departments/catalog';
import { PLANS } from '@/features/pricing/plans';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { fill } from '@/lib/fill';
import { ENTERPRISE } from './copy';
import {
  ADJUSTMENTS,
  BRANCH_EXAMPLES,
  buildProcess,
  CHAPTER,
  SYSTEMS,
  type Adjustment,
  type ProcessStep,
} from './model';
import { Head, Note } from './parts';

/* ------------------------------------------------------------------ */
/* 07 Custom workflow — switch adjustments, watch the process change    */
/* ------------------------------------------------------------------ */

const BASE = new Set<ProcessStep>(buildProcess(new Set()));

export function WorkflowChapter() {
  const c = useCopy(ENTERPRISE).workflow;
  const [on, setOn] = useState<ReadonlySet<Adjustment>>(() => new Set(['approval']));
  const steps = buildProcess(on);
  const toggle = (a: Adjustment) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  const isAdjusted = (s: ProcessStep) =>
    !BASE.has(s) || (on.has('sequence') && (s === 'warehouse' || s === 'purchasing'));
  return (
    <Chapter id={CHAPTER.workflow} labelledBy="workflow-title" plane="grid" space="lg">
      <Frame width="wide">
        <Head
          eyebrow={c.eyebrow}
          id="workflow-title"
          title={c.title}
          lead={c.lead}
          size="statement"
        />

        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.6fr)] lg:gap-10">
          <div>
            <p id="workflow-adjust" className="text-caption font-semibold text-text-muted">
              {c.adjustLabel}
            </p>
            <ul aria-labelledby="workflow-adjust" className="mt-4 space-y-1.5">
              {ADJUSTMENTS.map((a) => {
                const pressed = on.has(a);
                return (
                  <li key={a}>
                    <button
                      type="button"
                      aria-pressed={pressed}
                      onClick={() => toggle(a)}
                      data-adjust={a}
                      className={cn(
                        'flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-label transition-colors duration-200',
                        pressed
                          ? 'bg-[rgb(25_195_154/0.14)] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)]'
                          : 'bg-white/[0.03] text-text-secondary hover:bg-white/[0.06] hover:text-text-primary',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-md border',
                          pressed
                            ? 'border-brand-glow bg-brand-primary/25'
                            : 'border-border-strong',
                        )}
                      >
                        {pressed && <Check className="size-3.5 text-brand-glow" />}
                      </span>
                      {c.adjustments[a]}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <Stage glow="clear" className="flex flex-col p-5 sm:p-8 lg:p-10">
            <p className="text-caption text-text-muted">{c.base}</p>
            <ol
              data-process={steps.join(',')}
              aria-live="polite"
              className="mt-5 flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-y-3 lg:mb-8"
            >
              {steps.map((s, i) => {
                const adjusted = isAdjusted(s);
                return (
                  <li
                    key={s}
                    data-process-step={s}
                    className="flex flex-col sm:flex-row sm:items-center"
                  >
                    <span
                      className={cn(
                        'flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 py-2 text-label sm:inline-flex',
                        s === 'done'
                          ? 'bg-brand-primary/20 font-medium text-text-primary'
                          : s === 'exception'
                            ? 'bg-[rgb(245_184_75/0.1)] text-warning shadow-[inset_0_0_0_1px_rgb(245_184_75/0.35)]'
                            : adjusted
                              ? 'bg-[rgb(25_195_154/0.12)] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.35)]'
                              : 'bg-white/[0.05] text-text-secondary',
                      )}
                    >
                      {adjusted && <Plus aria-hidden className="size-3.5 text-brand-glow" />}
                      {c.steps[s]}
                      {adjusted && <span className="sr-only"> ({c.added})</span>}
                    </span>
                    {i < steps.length - 1 && (
                      <>
                        <ChevronDown
                          aria-hidden
                          className="my-0.5 ml-4 size-4 text-text-muted sm:hidden"
                        />
                        <ChevronRight
                          aria-hidden
                          className="mx-1 hidden size-4 text-text-muted sm:block"
                        />
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="mt-8 flex items-center gap-2 border-t border-white/[0.06] pt-5 text-caption text-text-muted lg:mt-auto">
              <Plus aria-hidden className="size-3.5 text-brand-glow" />
              {c.added}
            </p>
          </Stage>
        </div>
        <Note className="mt-10 max-w-3xl">
          <span data-workflow-package>{c.packageNote}</span>
        </Note>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 08 API & integration — CORE at the centre, systems on the perimeter  */
/* ------------------------------------------------------------------ */

const ORBIT = { cx: 300, cy: 220, rx: 230, ry: 160 };
const orbitPoint = (i: number) => {
  const a = (-90 + i * 45) * (Math.PI / 180);
  return { x: ORBIT.cx + ORBIT.rx * Math.cos(a), y: ORBIT.cy + ORBIT.ry * Math.sin(a) };
};

export function IntegrationChapter() {
  const c = useCopy(ENTERPRISE).integration;
  return (
    <Chapter id={CHAPTER.integration} labelledBy="integration-title" plane="deep" space="lg">
      <Frame width="wide">
        <Head eyebrow={c.eyebrow} id="integration-title" title={c.title} lead={c.lead} center />

        <figure aria-label={c.title.replace('\n', ' ')} className="mx-auto mt-14 max-w-4xl">
          <svg aria-hidden viewBox="0 0 600 440" className="hidden w-full md:block">
            <ellipse
              cx={ORBIT.cx}
              cy={ORBIT.cy}
              rx={ORBIT.rx}
              ry={ORBIT.ry}
              fill="none"
              stroke="var(--color-border-soft)"
            />
            {SYSTEMS.map((s, i) => {
              const p = orbitPoint(i);
              return (
                <line
                  key={s}
                  x1={ORBIT.cx}
                  y1={ORBIT.cy}
                  x2={p.x}
                  y2={p.y}
                  stroke="var(--color-brand-glow)"
                  strokeOpacity="0.4"
                  strokeDasharray="3 5"
                />
              );
            })}
            <circle cx={ORBIT.cx} cy={ORBIT.cy} r="70" fill="rgb(25 195 154 / 0.08)" />
            <circle
              cx={ORBIT.cx}
              cy={ORBIT.cy}
              r="48"
              fill="var(--color-surface-raised)"
              stroke="var(--color-brand-glow)"
              strokeWidth="2"
            />
            <text
              x={ORBIT.cx}
              y={ORBIT.cy + 6}
              textAnchor="middle"
              fontSize="17"
              fontWeight="600"
              fill="var(--color-text-primary)"
            >
              CORE
            </text>
            {SYSTEMS.map((s, i) => {
              const p = orbitPoint(i);
              const w = Math.max(84, c.systems[s].length * 7.4 + 28);
              return (
                <g key={s}>
                  <rect
                    x={p.x - w / 2}
                    y={p.y - 17}
                    width={w}
                    height="34"
                    rx="17"
                    fill="var(--color-surface-base)"
                    stroke="var(--color-border-strong)"
                    strokeDasharray="4 3"
                  />
                  <text
                    x={p.x}
                    y={p.y + 4.5}
                    textAnchor="middle"
                    fontSize="12.5"
                    fill="var(--color-text-secondary)"
                  >
                    {c.systems[s]}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="mb-3 flex items-center gap-2 text-label font-semibold text-brand-soft md:hidden">
            <span aria-hidden className="size-2.5 rounded-full bg-brand-glow" />
            CORE
          </p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 border-l border-brand-glow/40 pl-4 md:sr-only">
            {SYSTEMS.map((s) => (
              <li key={s} data-system={s} className="text-label text-text-secondary">
                {c.systems[s]}
              </li>
            ))}
          </ul>
        </figure>
        <p
          className="mx-auto mt-6 max-w-2xl text-center text-caption text-text-muted"
          data-concept-note
        >
          {c.conceptNote}
        </p>

        <div className="mx-auto mt-16 max-w-5xl">
          <Kicker tone="muted">{c.packagesTitle}</Kicker>
          <dl
            data-api-tiers
            className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-[1.5rem] bg-white/[0.05] sm:grid-cols-2 lg:grid-cols-4"
          >
            {PLANS.map((p) => (
              <div
                key={p.id}
                data-api-plan={p.id}
                data-api={p.api}
                className={cn(
                  'px-5 py-5',
                  p.id === 'enterprise' ? 'bg-[rgb(9_30_30)]' : 'bg-[rgb(8_17_25)]',
                )}
              >
                <dt className="text-caption text-text-muted">{p.name}</dt>
                <dd
                  className={cn(
                    'mt-1 text-label',
                    p.api === 'no' ? 'text-text-muted' : 'text-text-primary',
                  )}
                >
                  {p.id === 'enterprise' ? c.enterpriseApi : c.api[p.api]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 09 Multi-branch — one company, many branches, one CORE               */
/* ------------------------------------------------------------------ */

const BRANCHES = ['hq', 1, 2, 3] as const;

export function BranchesChapter() {
  const c = useCopy(ENTERPRISE).branches;
  return (
    <Chapter id={CHAPTER.branches} labelledBy="branches-title" plane="navy">
      <Frame width="wide">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] lg:gap-20">
          <div>
            <Head eyebrow={c.eyebrow} id="branches-title" title={c.title} lead={c.lead} />
            <p className="mt-10 text-caption font-semibold text-text-muted">{c.prefix}</p>
            <ul className="mt-3 space-y-2" data-branch-examples>
              {BRANCH_EXAMPLES.map((x) => (
                <li key={x} className="flex items-start gap-2.5 text-label text-text-primary">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-glow" />
                  {c.examples[x]}
                </li>
              ))}
            </ul>
          </div>

          {/* The company tree */}
          <figure data-branch-tree aria-label={c.title.replace('\n', ' ')}>
            <div className="flex items-center gap-3 rounded-2xl bg-[linear-gradient(90deg,rgb(25_195_154/0.2),rgb(25_195_154/0.05))] px-5 py-4 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.28)]">
              <Building2 aria-hidden className="size-5 text-brand-glow" />
              <span className="text-body font-semibold text-text-primary">{c.company}</span>
              <span className="ml-auto text-caption text-brand-soft">CORE · 1</span>
            </div>
            <div aria-hidden className="mx-auto h-6 w-px bg-brand-glow/50" />
            <ul className="relative grid grid-cols-2 gap-3 pt-6 before:absolute before:top-0 before:right-[12.5%] before:left-[12.5%] before:hidden before:h-px before:bg-brand-glow/50 sm:grid-cols-4 sm:before:block">
              {BRANCHES.map((b) => (
                <li
                  key={b}
                  data-branch={b}
                  className="relative rounded-2xl bg-white/[0.04] px-4 py-4 before:absolute before:-top-6 before:left-1/2 before:hidden before:h-6 before:w-px before:bg-brand-glow/50 sm:before:block"
                >
                  <p className="text-label font-medium text-text-primary">
                    {b === 'hq' ? c.hq : fill(c.branch, { n: b })}
                  </p>
                  <p aria-hidden className="mt-3 flex gap-1.5">
                    {DEPT_PAGES.slice(b === 'hq' ? 0 : 1, b === 'hq' ? 6 : 1 + b + 2).map((d) => (
                      <span
                        key={d}
                        className="size-2 rounded-full"
                        style={{ background: `var(--color-ws-${d})` }}
                      />
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          </figure>
        </div>
        <Note className="mt-14 max-w-3xl">
          <span data-branch-distinction>{c.distinction}</span>
        </Note>
      </Frame>
    </Chapter>
  );
}
