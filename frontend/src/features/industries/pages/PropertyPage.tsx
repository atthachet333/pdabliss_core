import { motion } from 'framer-motion';
import { ArrowRight, Building, Check, GitFork, Inbox, Wrench } from 'lucide-react';
import { useRef, useState } from 'react';
import { Chapter, Frame, Kicker, Stage } from '@/components/editorial/Layout';
import { tabKeys } from '@/features/departments/tabs';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { PROPERTY } from '../copy/property';
import { INDUSTRIES_SUMMARY } from '../copy/summary';
import { INDUSTRIES, REQUESTS, type RequestStage } from '../model';
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

const ID = 'property';
const IND = INDUSTRIES[ID];

/* Hero: a skyline of sites, each with open requests ------------------- */

const TOWERS = [
  { site: 'a', x: 140, w: 120, h: 190, pins: 2 },
  { site: 'b', x: 330, w: 170, h: 140, pins: 1 },
  { site: 'c', x: 570, w: 110, h: 110, pins: 1 },
] as const;

function Skyline() {
  const c = useCopy(PROPERTY).signature;
  const reduce = usePrefersReducedMotion();
  return (
    <svg
      aria-hidden
      viewBox="0 0 900 260"
      preserveAspectRatio="xMidYMax meet"
      className="w-full"
      data-motif="sites"
    >
      <line x1="0" y1="250" x2="900" y2="250" stroke="var(--color-border-strong)" />
      {TOWERS.map((t, i) => (
        <motion.g
          key={t.site}
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, y: 20 },
                animate: { opacity: 1, y: 0 },
                transition: { delay: 0.2 + i * 0.18, duration: 0.7, ease: EASE_CORE },
              })}
        >
          <rect
            x={t.x}
            y={250 - t.h}
            width={t.w}
            height={t.h}
            rx="4"
            fill="var(--color-surface-raised)"
            stroke="var(--color-border-strong)"
          />
          {Array.from({ length: Math.floor(t.h / 26) }).map((_, r) =>
            Array.from({ length: Math.floor(t.w / 30) }).map((__, k) => (
              <rect
                key={`${r}-${k}`}
                x={t.x + 12 + k * 30}
                y={250 - t.h + 14 + r * 26}
                width="14"
                height="10"
                rx="1.5"
                fill="rgb(190 235 222 / 0.08)"
              />
            )),
          )}
          <text
            x={t.x + t.w / 2}
            y="244"
            textAnchor="middle"
            fontSize="12"
            fill="var(--color-text-muted)"
          >
            {c.sites[t.site]}
          </text>
          {Array.from({ length: t.pins }).map((_, k) => {
            const px = t.x + t.w / 2 + (k - (t.pins - 1) / 2) * 34;
            const py = 250 - t.h - 26;
            return (
              <g key={k}>
                <line
                  x1={px}
                  y1={py + 10}
                  x2={px}
                  y2={250 - t.h}
                  stroke="var(--color-warning)"
                  strokeOpacity="0.6"
                />
                <circle
                  cx={px}
                  cy={py}
                  r="10"
                  fill="var(--color-surface-dark)"
                  stroke="var(--color-warning)"
                  strokeWidth="1.6"
                />
                <text
                  x={px}
                  y={py + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="var(--color-warning)"
                >
                  !
                </text>
              </g>
            );
          })}
        </motion.g>
      ))}
      {/* An outside vendor, connected to a request */}
      <path
        d="M 200 34 C 400 -10, 700 30, 800 130"
        fill="none"
        stroke="var(--color-text-muted)"
        strokeDasharray="4 6"
      />
      <rect
        x="740"
        y="130"
        width="130"
        height="40"
        rx="20"
        fill="var(--color-surface-base)"
        stroke="var(--color-border-strong)"
      />
      <text x="805" y="155" textAnchor="middle" fontSize="12" fill="var(--color-text-secondary)">
        {c.vendor}
      </text>
    </svg>
  );
}

function Hero() {
  const c = useCopy(PROPERTY);
  return (
    <section
      aria-labelledby="industry-title"
      className="relative isolate overflow-hidden"
      data-industry-hero={ID}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-[linear-gradient(0deg,rgb(190_235_222/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(190_235_222/0.05)_1px,transparent_1px)] [mask-image:linear-gradient(to_top,black,transparent)] [background-size:40px_40px]"
      />
      <Frame width="wide" className="pt-24 sm:pt-28 lg:pt-32">
        <BackLink />
        <div className="mt-6 max-w-3xl">
          <Kicker tone="clear">{c.hero.eyebrow}</Kicker>
          <PageTitle className="mt-5">{c.hero.title}</PageTitle>
          <p className="mt-7 max-w-2xl text-body-lg text-text-secondary">{c.hero.lead}</p>
        </div>
      </Frame>
      <figure aria-label={c.hero.visual} className="mt-12">
        <div className="mx-auto hidden max-w-[1240px] px-4 md:block">
          <Skyline />
        </div>
        <ul className="mx-4 mb-10 space-y-2 md:hidden">
          {TOWERS.map((t) => (
            <li
              key={t.site}
              className="flex min-h-12 items-center justify-between rounded-xl bg-white/[0.04] px-4"
            >
              <span className="flex items-center gap-2 text-label text-text-primary">
                <Building aria-hidden className="size-4 text-text-muted" />
                {c.signature.sites[t.site]}
              </span>
              <span className="text-caption text-warning tabular">{t.pins} !</span>
            </li>
          ))}
        </ul>
      </figure>
    </section>
  );
}

/* Signature: three requests, stuck in three places -------------------- */

function RequestJourney() {
  const c = useCopy(PROPERTY).signature;
  const [index, setIndex] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const r = REQUESTS[index]!;
  const copy = c.requests[r.id];
  const stuckAt = (r.path as readonly RequestStage[]).indexOf(r.stuck);
  return (
    <Chapter id="requests" labelledBy="requests-title" plane="deep" space="lg">
      <Frame width="wide">
        <Head id="requests-title" eyebrow={c.eyebrow} title={c.title} lead={c.lead} />
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.4fr)]">
          <div
            role="radiogroup"
            aria-label={c.choose}
            onKeyDown={(e) => tabKeys(REQUESTS.length, index, setIndex, refs)(e)}
            className="space-y-2"
          >
            {REQUESTS.map((q, i) => {
              const on = i === index;
              return (
                <button
                  key={q.id}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setIndex(i)}
                  data-request={q.id}
                  className={cn(
                    'flex min-h-16 w-full flex-col items-start justify-center rounded-2xl px-5 py-3 text-left transition-colors',
                    on
                      ? 'bg-[rgb(245_184_75/0.08)] shadow-[inset_0_0_0_1px_rgb(245_184_75/0.35)]'
                      : 'bg-white/[0.03] hover:bg-white/[0.06]',
                  )}
                >
                  <span className="text-label font-semibold text-text-primary">
                    {c.requests[q.id].title}
                  </span>
                  <span className="mt-0.5 text-caption text-text-muted">
                    {c.sites[q.site]} · {c.requests[q.id].age}
                  </span>
                </button>
              );
            })}
          </div>
          <Stage glow="warm" className="p-6 sm:p-8">
            <div aria-live="polite" data-journey={r.id} data-stuck={r.stuck}>
              <p className="text-caption text-text-muted">
                {c.sites[r.site]} · {copy.age}
              </p>
              <p className="mt-1 text-h3 font-semibold text-text-primary">{copy.title}</p>
              <ol className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
                {r.path.map((st, i) => {
                  const passed = i < stuckAt;
                  const stuck = i === stuckAt;
                  return (
                    <li
                      key={st}
                      data-stage={st}
                      data-state={passed ? 'passed' : stuck ? 'stuck' : 'ahead'}
                      className="flex items-center sm:flex-1"
                    >
                      <span
                        className={cn(
                          'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-caption',
                          passed && 'bg-brand-primary/12 text-text-primary',
                          stuck &&
                            'bg-[rgb(245_184_75/0.16)] font-semibold text-warning shadow-[inset_0_0_0_1px_rgb(245_184_75/0.45)]',
                          !passed &&
                            !stuck &&
                            'text-text-muted shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]',
                        )}
                      >
                        {passed && <Check aria-hidden className="size-3.5 text-brand-glow" />}
                        {c.stages[st]}
                      </span>
                      {i < r.path.length - 1 && (
                        <span
                          aria-hidden
                          className="mx-1 hidden h-px w-3 bg-border-strong sm:block"
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
              <dl className="mt-8 grid grid-cols-1 gap-5 border-t border-white/[0.06] pt-6 sm:grid-cols-2">
                <div>
                  <dt className="text-caption text-warning">{c.stuckAt}</dt>
                  <dd className="mt-1 text-label text-text-primary">{copy.stuck}</dd>
                </div>
                <div>
                  <dt className="text-caption text-brand-soft">{c.nextStep}</dt>
                  <dd className="mt-1 text-label text-text-primary">{copy.next}</dd>
                </div>
              </dl>
            </div>
          </Stage>
        </div>
      </Frame>
    </Chapter>
  );
}

/* Example workflow: a journey with a vendor / material fork ------------ */

function Journey() {
  const c = useCopy(PROPERTY);
  const s = useCopy(INDUSTRIES_SUMMARY).industries[ID];
  const name = useDeptName();
  return (
    <Chapter id="workflow" labelledBy="workflow-title" space="lg">
      <Frame width="base">
        <Head id="workflow-title" title={c.workflow.title} center />
        <ExampleLabel className="mx-auto mt-5 max-w-md text-center [&>p:first-child]:justify-center" />
        <ol data-workflow={ID} className="mx-auto mt-12 max-w-2xl space-y-2">
          {IND.workflow.map((w, i) => {
            const fork = w.id === IND.stuckAt;
            return (
              <li key={w.id} data-step={w.id} className={cn('relative', fork && 'ml-10 sm:ml-16')}>
                {fork && (
                  <GitFork
                    aria-hidden
                    className="absolute top-4 -left-8 size-4 text-warning sm:-left-11"
                  />
                )}
                <div
                  className={cn(
                    'flex items-start gap-4 rounded-2xl px-5 py-4',
                    fork
                      ? 'border border-dashed border-warning/50 bg-[rgb(245_184_75/0.04)]'
                      : 'bg-white/[0.035]',
                  )}
                >
                  <span className="mt-0.5 text-caption text-text-muted tabular">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1">
                    <p className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-label font-semibold text-text-primary">
                        {s.steps[w.id]}
                      </span>
                      <span className="flex items-center gap-1.5 text-caption text-text-muted">
                        <DeptDot id={w.dept} className="size-1.5" />
                        {name(w.dept)}
                      </span>
                    </p>
                    <p className="mt-1 text-caption text-text-secondary">
                      {c.workflow.notes[w.id]}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Frame>
    </Chapter>
  );
}

/* Page ---------------------------------------------------------------- */

export default function PropertyPage() {
  const c = useIndustryPage(PROPERTY);
  const s = useCopy(INDUSTRIES_SUMMARY);
  const name = useDeptName();
  const intake = c.signature.intake;
  return (
    <>
      <Hero />

      {/* The boundary first: internal operations, not the property product */}
      <Chapter id="boundary" labelledBy="boundary-title" space="sm">
        <Frame width="base">
          <h2 id="boundary-title" className="sr-only">
            {s.common.boundaries.propertyProduct.title}
          </h2>
          <Boundaries id={ID} prominent />
        </Frame>
      </Chapter>

      {/* Reality + intake */}
      <Chapter id="reality" labelledBy="reality-title" plane="navy">
        <Frame width="wide">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-20">
            <div>
              <Head id="reality-title" title={c.reality.title} lead={c.reality.lead} />
              <ul className="mt-8 space-y-5">
                {c.reality.points.map((pt) => (
                  <li key={pt.title} className="flex gap-3">
                    <Wrench aria-hidden className="mt-1 size-4 shrink-0 text-brand-glow" />
                    <p className="text-label text-text-secondary">
                      <span className="block text-body font-semibold text-text-primary">
                        {pt.title}
                      </span>
                      {pt.body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div data-intake className="self-center">
              <p className="text-caption font-semibold text-text-muted">{intake.title}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {intake.channels.map((ch) => (
                  <li
                    key={ch}
                    className="rounded-full bg-white/[0.05] px-4 py-2 text-label text-text-secondary"
                  >
                    {ch}
                  </li>
                ))}
              </ul>
              <div aria-hidden className="ml-8 h-8 w-px bg-brand-glow/50" />
              <p className="flex items-center gap-3 rounded-2xl bg-[linear-gradient(90deg,rgb(25_195_154/0.18),rgb(25_195_154/0.04))] px-5 py-4 text-label font-semibold text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.28)]">
                <Inbox aria-hidden className="size-5 text-brand-glow" />
                {intake.one}
              </p>
            </div>
          </div>
        </Frame>
      </Chapter>

      <RequestJourney />
      <Journey />

      <Chapter id="friction" labelledBy="friction-title" plane="grid">
        <Frame width="wide">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <Head id="friction-title" title={c.frictions.title} />
            <ol className="columns-1 gap-10 space-y-4 sm:columns-2" data-frictions>
              {c.frictions.items.map((f, i) => (
                <li
                  key={f}
                  className="break-inside-avoid border-t border-border-soft pt-4 text-label text-text-secondary"
                >
                  <span className="mr-2 text-caption text-warning tabular">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {f}
                </li>
              ))}
            </ol>
          </div>
        </Frame>
      </Chapter>

      <Chapter id="departments" labelledBy="departments-title">
        <Frame width="wide">
          <Head id="departments-title" title={c.departments.title} />
          <ul
            className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-[1.75rem] bg-white/[0.05] sm:grid-cols-2 lg:grid-cols-4"
            data-departments
          >
            {IND.departments.map((d) => (
              <li key={d} data-dept={d} className="bg-[rgb(8_17_25)] px-5 py-6">
                <p className="flex items-center gap-2 text-label font-semibold text-text-primary">
                  <DeptDot id={d} />
                  {name(d)}
                </p>
                <p className="mt-2 text-caption text-text-secondary">{c.departments.roles[d]}</p>
              </li>
            ))}
          </ul>
          <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h3 id="signals-title" className="text-h3 text-text-primary">
                {c.signals.title}
              </h3>
              <ul className="mt-6 space-y-4" data-signals={ID}>
                {IND.signals.map((sg) => (
                  <li key={sg.id} data-signal={sg.id} className="flex flex-col gap-1">
                    <ToneTag tone={sg.tone} label={s.industries[ID].signals[sg.id]!} />
                    <p className="text-label text-text-secondary">{c.signals.notes[sg.id]}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Kicker tone="muted">{c.information.title}</Kicker>
              <dl className="mt-5 divide-y divide-border-soft" data-information>
                {c.information.items.map((it) => (
                  <div
                    key={it.label}
                    className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"
                  >
                    <dt className="text-label font-semibold text-text-primary">{it.label}</dt>
                    <dd className="text-label text-text-secondary">{it.why}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Frame>
      </Chapter>

      <Chapter id="fit" labelledBy="fit-title" plane="navy">
        <Frame width="wide">
          <Head id="fit-title" title={c.fit.title} lead={c.fit.lead} />
          <PrincipleFit id={ID} className="mt-12" />
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
