import { motion } from 'framer-motion';
import { ArrowDown, ArrowRight, Check, Layers, PackageCheck } from 'lucide-react';
import { useState } from 'react';
import { Chapter, Frame, Kicker, Stage } from '@/components/editorial/Layout';
import type { DeptKey } from '@/features/departments/catalog';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { fill } from '@/lib/fill';
import { EASE_CORE } from '@/motion/tokens';
import { MANUFACTURING } from '../copy/manufacturing';
import { INDUSTRIES_SUMMARY } from '../copy/summary';
import { buildable, INDUSTRIES, MATERIAL_INBOUND, MATERIALS, WORK_ORDER } from '../model';
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

const ID = 'manufacturing';
const IND = INDUSTRIES[ID];
const LANES = ['material', 'workOrder', 'operations', 'output'] as const;

/* Hero: material flowing across lanes into output --------------------- */

function MaterialLanes() {
  const c = useCopy(MANUFACTURING).signature;
  const short = useCopy(MANUFACTURING).signature.short;
  const reduce = usePrefersReducedMotion();
  const y = (i: number) => 40 + i * 58;
  return (
    <svg
      aria-hidden
      viewBox="0 0 1400 250"
      preserveAspectRatio="xMidYMid meet"
      className="w-full"
      data-motif="lanes"
    >
      {LANES.map((l, i) => (
        <g key={l}>
          <line x1="0" y1={y(i)} x2="1400" y2={y(i)} stroke="var(--color-border-soft)" />
          <text x="24" y={y(i) - 10} fontSize="13" fill="var(--color-text-muted)">
            {c.lanes[l]}
          </text>
        </g>
      ))}
      {/* Materials entering */}
      {[220, 300, 380].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={y(0) - 9}
          width="18"
          height="18"
          rx="3"
          fill={i === 1 ? 'none' : 'var(--color-ws-warehouse)'}
          stroke={i === 1 ? 'var(--color-warning)' : 'none'}
          strokeDasharray={i === 1 ? '3 3' : undefined}
        />
      ))}
      <text x="309" y={y(0) + 30} textAnchor="middle" fontSize="11" fill="var(--color-warning)">
        {short}
      </text>
      <motion.path
        d={`M 400 ${y(0)} C 480 ${y(0)}, 480 ${y(1)}, 560 ${y(1)} L 700 ${y(1)} C 780 ${y(1)}, 780 ${y(2)}, 860 ${y(2)} L 1000 ${y(2)} C 1080 ${y(2)}, 1080 ${y(3)}, 1160 ${y(3)} L 1340 ${y(3)}`}
        fill="none"
        stroke="var(--color-brand-glow)"
        strokeWidth="2"
        {...(reduce
          ? {}
          : {
              initial: { pathLength: 0 },
              animate: { pathLength: 1 },
              transition: { delay: 0.3, duration: 1.8, ease: EASE_CORE },
            })}
      />
      <rect
        x="560"
        y={y(1) - 18}
        width="140"
        height="36"
        rx="8"
        fill="var(--color-surface-raised)"
        stroke="var(--color-ws-operations)"
        strokeWidth="1.6"
      />
      <text x="630" y={y(1) + 5} textAnchor="middle" fontSize="13" fill="var(--color-text-primary)">
        {c.wo}
      </text>
      {[860, 900, 940].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={y(2) - 10}
          width="28"
          height="20"
          rx="4"
          fill={i < 2 ? 'rgb(169 154 240 / 0.45)' : 'none'}
          stroke="var(--color-ws-operations)"
        />
      ))}
      <rect
        x="1160"
        y={y(3) - 16}
        width="170"
        height="32"
        rx="8"
        fill="var(--color-surface-raised)"
        stroke="var(--color-ws-warehouse)"
      />
      <text
        x="1245"
        y={y(3) + 5}
        textAnchor="middle"
        fontSize="12"
        fill="var(--color-text-secondary)"
      >
        LOT-OUT-2410
      </text>
    </svg>
  );
}

function Hero() {
  const c = useCopy(MANUFACTURING);
  return (
    <section
      aria-labelledby="industry-title"
      className="relative isolate overflow-hidden"
      data-industry-hero={ID}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[repeating-linear-gradient(0deg,transparent_0,transparent_57px,rgb(190_235_222/0.04)_57px,rgb(190_235_222/0.04)_58px)]"
      />
      <Frame width="wide" className="pt-24 sm:pt-28 lg:pt-32">
        <BackLink />
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end lg:gap-16">
          <div>
            <Kicker tone="clear">{c.hero.eyebrow}</Kicker>
            <PageTitle className="mt-5">{c.hero.title}</PageTitle>
          </div>
          <p className="border-l-2 border-ws-operations/60 pl-5 text-body-lg text-text-secondary">
            {c.hero.lead}
          </p>
        </div>
      </Frame>
      <figure
        aria-label={c.hero.visual}
        className="mt-14 mb-16 border-y border-border-soft bg-[rgb(6_13_20/0.6)] py-6 lg:mb-24"
      >
        <div className="hidden md:block">
          <MaterialLanes />
        </div>
        <ol className="mx-4 space-y-1 md:hidden">
          {LANES.map((l, i) => (
            <li key={l}>
              <p className="flex min-h-11 items-center rounded-xl bg-white/[0.04] px-4 text-label text-text-primary">
                {c.signature.lanes[l]}
                {l === 'material' && (
                  <ToneTag tone="attention" label={c.signature.short} className="ml-auto" />
                )}
              </p>
              {i < LANES.length - 1 && (
                <ArrowDown aria-hidden className="mx-auto my-1 size-4 text-brand-glow" />
              )}
            </li>
          ))}
        </ol>
      </figure>
    </section>
  );
}

/* Signature: the Work Order board ------------------------------------- */

function WorkOrderBoard() {
  const c = useCopy(MANUFACTURING).signature;
  const [received, setReceived] = useState(false);
  const can = buildable(received);
  const pct = (n: number) => `${(n / WORK_ORDER.planned) * 100}%`;
  return (
    <Chapter id="work-order" labelledBy="work-order-title" plane="deep" space="lg">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)] lg:items-start lg:gap-14">
          <Stage glow="clear" className="order-2 p-5 sm:p-8 lg:order-1">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-h3 font-semibold text-text-primary">
                {c.wo}{' '}
                <span className="text-label font-normal text-text-secondary">· {c.product}</span>
              </p>
              <p className="text-caption text-text-muted tabular" data-wo-progress>
                {c.done} {WORK_ORDER.done} / {c.planned} {WORK_ORDER.planned} {c.unit}
              </p>
            </div>
            {/* Progress: produced, buildable, remaining */}
            <div
              className="relative mt-5 h-3 overflow-hidden rounded-full bg-white/[0.06]"
              aria-hidden
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-ws-operations/40 transition-[width] duration-500"
                style={{ width: pct(can) }}
              />
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-brand-glow"
                style={{ width: pct(WORK_ORDER.done) }}
              />
            </div>
            <p
              aria-live="polite"
              data-buildable={can}
              className={cn(
                'mt-3 text-label font-medium',
                can >= WORK_ORDER.planned ? 'text-success' : 'text-warning',
              )}
            >
              {fill(c.buildable, { n: can, total: WORK_ORDER.planned })}
            </p>

            <table className="mt-8 w-full text-left" data-materials>
              <caption className="pb-3 text-left text-caption font-semibold text-text-muted">
                {c.materialsTitle}
              </caption>
              <thead>
                <tr className="text-caption text-text-muted">
                  <th scope="col" className="pb-2 font-normal">
                    <span className="sr-only">{c.materialsTitle}</span>
                  </th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    {c.required}
                  </th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    {c.available}
                  </th>
                  <th scope="col" className="pb-2 pl-4 font-normal">
                    <span className="sr-only">{c.short}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {MATERIALS.map((m) => {
                  const have = m.available + (received ? (MATERIAL_INBOUND[m.id] ?? 0) : 0);
                  const ok = have >= m.required;
                  return (
                    <tr key={m.id} data-material={m.id} data-enough={ok}>
                      <th
                        scope="row"
                        className="py-3 pr-3 text-label font-normal text-text-primary"
                      >
                        {c.materials[m.id]}
                      </th>
                      <td className="py-3 text-right text-label text-text-secondary tabular">
                        {m.required}
                      </td>
                      <td className="py-3 text-right text-label text-text-primary tabular">
                        {have}
                      </td>
                      <td className="py-3 pl-4">
                        <ToneTag
                          tone={ok ? 'ok' : 'attention'}
                          label={ok ? c.enough : `${c.short} ${m.required - have}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-6 flex flex-col gap-4 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                aria-pressed={received}
                onClick={() => setReceived((v) => !v)}
                data-receive
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-label transition-colors',
                  received
                    ? 'bg-brand-primary/20 text-text-primary'
                    : 'bg-white/[0.05] text-text-secondary hover:text-text-primary',
                )}
              >
                {received ? (
                  <Check aria-hidden className="size-4 text-brand-glow" />
                ) : (
                  <PackageCheck aria-hidden className="size-4" />
                )}
                {received ? c.received : c.receive}
              </button>
              <p className="flex items-center gap-2 text-caption text-text-secondary">
                <Layers aria-hidden className="size-3.5 text-ws-warehouse" />
                {c.outputLot}
              </p>
            </div>
            <p className="mt-3 text-caption text-text-muted">{c.partialNote}</p>
          </Stage>
          <div className="order-1 lg:sticky lg:top-28 lg:order-2">
            <Head id="work-order-title" eyebrow={c.eyebrow} title={c.title} lead={c.lead} />
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

/* Example workflow: swimlanes by department --------------------------- */

function Swimlanes() {
  const c = useCopy(MANUFACTURING);
  const s = useCopy(INDUSTRIES_SUMMARY).industries[ID];
  const name = useDeptName();
  const lanes = [...new Set(IND.workflow.map((w) => w.dept))] as DeptKey[];
  const n = IND.workflow.length;
  return (
    <Chapter id="workflow" labelledBy="workflow-title" space="lg">
      <Frame width="full">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)] lg:items-end">
          <Head id="workflow-title" title={c.workflow.title} />
          <ExampleLabel />
        </div>
        {/* Wide: one lane per department, steps placed in order */}
        <div
          aria-hidden
          className="mt-12 hidden overflow-hidden rounded-[2rem] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)] xl:block"
        >
          {lanes.map((d) => (
            <div
              key={d}
              className="grid border-b border-white/[0.05] last:border-b-0"
              style={{ gridTemplateColumns: `9rem repeat(${n}, minmax(0, 1fr))` }}
            >
              <span className="flex items-center gap-2 bg-white/[0.025] px-4 py-5 text-label font-semibold text-text-primary">
                <DeptDot id={d} />
                {name(d)}
              </span>
              {IND.workflow.map((w, i) => (
                <span
                  key={w.id}
                  className="flex items-center border-l border-white/[0.03] px-1.5 py-3"
                >
                  {w.dept === d && (
                    <span
                      className={cn(
                        'w-full rounded-lg px-2 py-2 text-caption leading-snug',
                        w.id === IND.stuckAt
                          ? 'bg-[rgb(245_184_75/0.14)] text-warning shadow-[inset_0_0_0_1px_rgb(245_184_75/0.4)]'
                          : 'bg-white/[0.06] text-text-primary',
                      )}
                    >
                      {/* EP19: the step number keeps AA on the amber "stuck" tint too. */}
                      <span
                        className={cn(
                          'block tabular',
                          w.id === IND.stuckAt ? 'text-warning/80' : 'text-text-muted',
                        )}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {s.steps[w.id]}
                    </span>
                  )}
                </span>
              ))}
            </div>
          ))}
        </div>
        {/* Every width: the readable sequence */}
        <ol data-workflow={ID} className="mt-10 grid grid-cols-1 gap-x-10 gap-y-3 md:grid-cols-2">
          {IND.workflow.map((w, i) => (
            <li key={w.id} data-step={w.id} className="flex gap-3 border-t border-border-soft pt-3">
              <span className="text-caption text-text-muted tabular">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>
                <span className="flex flex-wrap items-center gap-x-2 text-label font-semibold text-text-primary">
                  {s.steps[w.id]}
                  <span className="flex items-center gap-1 text-caption font-normal text-text-muted">
                    <DeptDot id={w.dept} className="size-1.5" />
                    {name(w.dept)}
                  </span>
                </span>
                <span className="mt-0.5 block text-caption text-text-secondary">
                  {c.workflow.notes[w.id]}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Frame>
    </Chapter>
  );
}

/* Page ---------------------------------------------------------------- */

export default function ManufacturingPage() {
  const c = useIndustryPage(MANUFACTURING);
  const s = useCopy(INDUSTRIES_SUMMARY);
  const name = useDeptName();
  return (
    <>
      <Hero />

      <Chapter id="reality" labelledBy="reality-title" plane="navy">
        <Frame width="wide">
          <Head id="reality-title" title={c.reality.title} lead={c.reality.lead} />
          <ol className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            {c.reality.points.map((pt, i) => (
              <li
                key={pt.title}
                className="relative overflow-hidden rounded-2xl bg-white/[0.03] px-6 pt-10 pb-6"
              >
                <span
                  aria-hidden
                  className="absolute top-0 left-0 h-1 bg-ws-operations/60"
                  style={{ width: `${(i + 1) * 33}%` }}
                />
                <p className="text-body font-semibold text-text-primary">{pt.title}</p>
                <p className="mt-1.5 text-label text-text-secondary">{pt.body}</p>
              </li>
            ))}
          </ol>
        </Frame>
      </Chapter>

      <WorkOrderBoard />
      <Swimlanes />

      <Chapter id="friction" labelledBy="friction-title" plane="grid">
        <Frame width="wide">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <Head id="friction-title" title={c.frictions.title} />
              <ul className="mt-8 space-y-3" data-frictions>
                {c.frictions.items.map((f) => (
                  <li
                    key={f}
                    className="flex gap-3 rounded-xl bg-white/[0.03] px-4 py-3 text-label text-text-primary"
                  >
                    <span aria-hidden className="mt-1.5 size-2 shrink-0 rotate-45 bg-warning/70" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Kicker tone="muted">{c.information.title}</Kicker>
              <dl className="mt-6 space-y-5" data-information>
                {c.information.items.map((it) => (
                  <div key={it.label} className="border-l-2 border-ws-warehouse/50 pl-4">
                    <dt className="text-label font-semibold text-text-primary">{it.label}</dt>
                    <dd className="mt-0.5 text-caption text-text-secondary">{it.why}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Frame>
      </Chapter>

      <Chapter id="departments" labelledBy="departments-title">
        <Frame width="wide">
          <Head id="departments-title" title={c.departments.title} />
          <ol
            className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            data-departments
          >
            {[...IND.departments, ...(IND.optional ?? [])].map((d) => (
              <li key={d} data-dept={d} className="rounded-2xl bg-white/[0.03] px-5 py-4">
                <p className="flex items-center gap-2 text-label font-semibold text-text-primary">
                  <DeptDot id={d} />
                  {name(d)}
                  {IND.optional?.includes(d) && (
                    <span className="text-caption font-normal text-text-muted">
                      ({s.common.optional})
                    </span>
                  )}
                </p>
                <p className="mt-1.5 text-caption text-text-secondary">{c.departments.roles[d]}</p>
              </li>
            ))}
          </ol>
          <Stage glow="warm" grid={false} className="mt-14 p-6 sm:p-8">
            <h3 id="signals-title" className="text-h3 text-text-primary">
              {c.signals.title}
            </h3>
            <ul
              className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
              data-signals={ID}
            >
              {IND.signals.map((sg) => (
                <li key={sg.id} data-signal={sg.id}>
                  <ToneTag tone={sg.tone} label={s.industries[ID].signals[sg.id]!} />
                  <p className="mt-1.5 text-caption text-text-secondary">
                    {c.signals.notes[sg.id]}
                  </p>
                </li>
              ))}
            </ul>
          </Stage>
        </Frame>
      </Chapter>

      <Chapter id="fit" labelledBy="fit-title" plane="navy">
        <Frame width="base">
          <Head id="fit-title" title={c.fit.title} lead={c.fit.lead} />
          <PrincipleFit id={ID} variant="ledger" className="mt-10" />
          <Boundaries id={ID} prominent className="mt-14" />
          <Limits notReplace={c.notReplace} custom={c.custom} className="mt-12" />
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
