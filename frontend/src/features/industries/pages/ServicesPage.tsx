import { motion } from 'framer-motion';
import { ArrowRight, Building2, Check, CircleDot, Clock, Inbox, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Chapter, Frame, Kicker, Stage } from '@/components/editorial/Layout';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { SERVICES } from '../copy/services';
import { INDUSTRIES_SUMMARY } from '../copy/summary';
import { EVIDENCE, INDUSTRIES, type Evidence } from '../model';
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

const ID = 'services';
const IND = INDUSTRIES[ID];

/* Hero: a team schedule with one job nobody has taken ----------------- */

type JobState = 'done' | 'active' | 'late';
const JOBS: readonly { team: number; slot: number; span: number; code: string; state: JobState }[] =
  [
    { team: 0, slot: 0, span: 1, code: 'JOB-214', state: 'done' },
    { team: 0, slot: 1, span: 2, code: 'JOB-219', state: 'active' },
    { team: 1, slot: 0, span: 2, code: 'JOB-216', state: 'late' },
    { team: 1, slot: 2, span: 1, code: 'JOB-222', state: 'active' },
    { team: 2, slot: 0, span: 1, code: 'JOB-215', state: 'done' },
    { team: 2, slot: 1, span: 1, code: 'JOB-220', state: 'active' },
  ];
const JOB_ICON = { done: Check, active: CircleDot, late: Clock } as const;

function ScheduleBoard() {
  const b = useCopy(SERVICES).signature.board;
  const reduce = usePrefersReducedMotion();
  return (
    <div
      data-motif="schedule"
      className="overflow-hidden rounded-[2rem] bg-[rgb(8_17_25)] shadow-[inset_0_0_0_1px_rgb(190_235_222/0.08)]"
    >
      <div className="grid grid-cols-[5.5rem_repeat(3,minmax(0,1fr))] border-b border-white/[0.06] text-caption text-text-muted sm:grid-cols-[7rem_repeat(3,minmax(0,1fr))]">
        <span className="px-4 py-3">{b.title}</span>
        {b.slots.map((s) => (
          <span key={s} className="border-l border-white/[0.04] px-4 py-3">
            {s}
          </span>
        ))}
      </div>
      {b.teams.map((t, ti) => (
        <div
          key={t}
          className="relative grid grid-cols-[5.5rem_repeat(3,minmax(0,1fr))] border-b border-white/[0.04] sm:grid-cols-[7rem_repeat(3,minmax(0,1fr))]"
        >
          <span className="flex items-center gap-2 px-4 py-5 text-label text-text-secondary">
            <UserRound aria-hidden className="size-4 text-ws-operations" />
            {t}
          </span>
          {[0, 1, 2].map((s) => (
            <span key={s} className="border-l border-white/[0.04]" />
          ))}
          {JOBS.filter((j) => j.team === ti).map((j, k) => {
            const Icon = JOB_ICON[j.state];
            return (
              <motion.span
                key={j.code}
                className={cn(
                  'absolute top-2.5 bottom-2.5 flex items-center gap-1.5 overflow-hidden rounded-lg px-2.5 text-caption',
                  j.state === 'late'
                    ? 'bg-[rgb(245_184_75/0.14)] text-warning shadow-[inset_0_0_0_1px_rgb(245_184_75/0.35)]'
                    : j.state === 'done'
                      ? 'bg-white/[0.05] text-text-muted'
                      : 'bg-[rgb(169_154_240/0.16)] text-text-primary shadow-[inset_0_0_0_1px_rgb(169_154_240/0.35)]',
                )}
                style={{
                  left: `calc(var(--lead) + (100% - var(--lead)) * ${j.slot / 3} + 4px)`,
                  width: `calc((100% - var(--lead)) * ${j.span / 3} - 8px)`,
                }}
                {...(reduce
                  ? {}
                  : {
                      initial: { opacity: 0, x: -8 },
                      animate: { opacity: 1, x: 0 },
                      transition: {
                        delay: 0.2 + (ti * 2 + k) * 0.1,
                        duration: 0.5,
                        ease: EASE_CORE,
                      },
                    })}
              >
                <Icon aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{j.code}</span>
              </motion.span>
            );
          })}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 px-4 py-4">
        <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-dashed border-warning/60 px-3 text-caption text-warning">
          <Inbox aria-hidden className="size-3.5" />
          JOB-223 · {b.unassigned}
        </span>
      </div>
    </div>
  );
}

function Hero() {
  const c = useCopy(SERVICES);
  return (
    <section
      aria-labelledby="industry-title"
      className="relative isolate overflow-hidden"
      data-industry-hero={ID}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(rgb(190_235_222/0.05)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent_80%)] [background-size:100%_28px]"
      />
      <Frame width="base" className="pt-24 pb-16 sm:pt-28 lg:pt-32 lg:pb-24">
        <BackLink />
        <div className="mx-auto mt-6 max-w-3xl text-center">
          <Kicker tone="clear" className="justify-center">
            {c.hero.eyebrow}
          </Kicker>
          <PageTitle className="mt-5">{c.hero.title}</PageTitle>
          <p className="mx-auto mt-7 max-w-2xl text-body-lg text-text-secondary">{c.hero.lead}</p>
        </div>
        <figure
          aria-label={c.hero.visual}
          className="mx-auto mt-14 max-w-4xl [--lead:5.5rem] sm:[--lead:7rem]"
        >
          <ScheduleBoard />
        </figure>
      </Frame>
    </section>
  );
}

/* Intake: many channels, one queue ------------------------------------ */

function Intake() {
  const c = useCopy(SERVICES).signature.intake;
  return (
    <Chapter id="intake" labelledBy="intake-title" plane="navy">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center lg:gap-16">
          <Head id="intake-title" title={c.title} lead={c.lead} />
          <div
            className="grid grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)]"
            data-intake
          >
            <ul className="space-y-2">
              {c.channels.map((ch) => (
                <li
                  key={ch}
                  className="rounded-xl bg-white/[0.04] px-4 py-3 text-label text-text-secondary"
                >
                  {ch}
                </li>
              ))}
            </ul>
            <svg
              aria-hidden
              viewBox="0 0 80 200"
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              {[25, 75, 125, 175].map((y) => (
                <path
                  key={y}
                  d={`M 0 ${y} C 40 ${y}, 40 100, 80 100`}
                  fill="none"
                  stroke="var(--color-brand-glow)"
                  strokeOpacity="0.5"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            <div className="rounded-2xl bg-[linear-gradient(160deg,rgb(25_195_154/0.2),rgb(25_195_154/0.05))] px-5 py-6 text-center shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)]">
              <Inbox aria-hidden className="mx-auto size-6 text-brand-glow" />
              <p className="mt-2 text-label font-semibold text-text-primary">{c.queue}</p>
            </div>
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

/* Example workflow: a people timeline with the handoff back to office -- */

function Timeline() {
  const c = useCopy(SERVICES);
  const s = useCopy(INDUSTRIES_SUMMARY).industries[ID];
  const name = useDeptName();
  return (
    <Chapter id="workflow" labelledBy="workflow-title" space="lg">
      <Frame width="base">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Head id="workflow-title" title={c.workflow.title} />
            <ExampleLabel className="mt-6" />
          </div>
          <ol
            data-workflow={ID}
            className="relative space-y-3 before:absolute before:top-4 before:bottom-4 before:left-[1.375rem] before:w-px before:bg-border-strong"
          >
            {IND.workflow.map((w) => {
              const stuck = w.id === IND.stuckAt;
              const field = w.dept === 'operations';
              return (
                <li key={w.id} data-step={w.id} className="relative flex gap-4">
                  <span
                    aria-hidden
                    className={cn(
                      'relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-dark',
                      stuck
                        ? 'shadow-[0_0_0_2px_var(--color-warning)]'
                        : 'shadow-[inset_0_0_0_1.5px_var(--color-border-strong)]',
                    )}
                  >
                    {field ? (
                      <UserRound className="size-4 text-ws-operations" />
                    ) : (
                      <Building2 className="size-4 text-text-secondary" />
                    )}
                  </span>
                  <div
                    className={cn(
                      'flex-1 rounded-2xl px-5 py-4',
                      field ? 'bg-[rgb(169_154_240/0.07)]' : 'bg-white/[0.03]',
                    )}
                  >
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
                </li>
              );
            })}
          </ol>
        </div>
      </Frame>
    </Chapter>
  );
}

/* Signature: evidence before close ------------------------------------ */

function EvidenceGate() {
  const g = useCopy(SERVICES).signature.gate;
  const [done, setDone] = useState<ReadonlySet<Evidence>>(() => new Set(['photos']));
  const ready = EVIDENCE.every((e) => done.has(e));
  const toggle = (e: Evidence) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
  return (
    <Chapter id="evidence" labelledBy="evidence-title" plane="deep" space="lg">
      <Frame width="base">
        <Head id="evidence-title" eyebrow={g.eyebrow} title={g.title} lead={g.lead} center />
        <Stage glow={ready ? 'clear' : 'warm'} className="mx-auto mt-12 max-w-3xl p-6 sm:p-10">
          <p className="text-caption text-text-muted">{g.team}</p>
          <p className="mt-1 text-h3 font-semibold text-text-primary">{g.job}</p>
          <ul className="mt-8 space-y-2">
            {EVIDENCE.map((e) => {
              const on = done.has(e);
              return (
                <li key={e}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggle(e)}
                    data-evidence={e}
                    className={cn(
                      'flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-label transition-colors',
                      on
                        ? 'bg-brand-primary/12 text-text-primary'
                        : 'bg-white/[0.03] text-text-secondary hover:bg-white/[0.06]',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-5 items-center justify-center rounded-md border',
                        on ? 'border-brand-glow bg-brand-primary/25' : 'border-border-strong',
                      )}
                    >
                      {on && <Check className="size-3.5 text-brand-glow" />}
                    </span>
                    <span className="flex-1">{g.evidence[e]}</span>
                    {!on && <span className="text-caption text-warning">{g.missing}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <p
            aria-live="polite"
            data-close={ready ? 'ready' : 'blocked'}
            className="mt-6 border-t border-white/[0.06] pt-5"
          >
            <ToneTag
              tone={ready ? 'ok' : 'blocked'}
              label={ready ? g.ready : g.blocked}
              className="text-label"
            />
          </p>
          <p className="mt-2 text-caption text-text-muted">{g.note}</p>
        </Stage>
      </Frame>
    </Chapter>
  );
}

/* Page ---------------------------------------------------------------- */

export default function ServicesPage() {
  const c = useIndustryPage(SERVICES);
  const s = useCopy(INDUSTRIES_SUMMARY);
  const name = useDeptName();
  const office = IND.departments.filter((d) => d !== 'operations');
  return (
    <>
      <Hero />

      {/* What it feels like: frictions first, as the voices of the job */}
      <Chapter id="friction" labelledBy="friction-title" space="lg">
        <Frame width="wide">
          <Head id="friction-title" title={c.frictions.title} lead={c.reality.lead} />
          <ul
            className="mt-12 grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3"
            data-frictions
          >
            {c.frictions.items.map((f) => (
              <li key={f} className="border-l-2 border-warning/50 pl-5 text-body text-text-primary">
                “{f}”
              </li>
            ))}
          </ul>
          <dl
            className="mt-16 grid grid-cols-1 gap-8 border-t border-border-soft pt-10 md:grid-cols-3"
            data-reality
          >
            <dt className="sr-only">{c.reality.title}</dt>
            {c.reality.points.map((pt) => (
              <dd key={pt.title}>
                <p className="text-body font-semibold text-text-primary">{pt.title}</p>
                <p className="mt-1.5 text-label text-text-secondary">{pt.body}</p>
              </dd>
            ))}
          </dl>
        </Frame>
      </Chapter>

      <Intake />
      <Timeline />
      <EvidenceGate />

      {/* Who touches the job: field and office */}
      <Chapter id="departments" labelledBy="departments-title" plane="navy">
        <Frame width="wide">
          <Head id="departments-title" title={c.departments.title} />
          <div
            className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
            data-departments
          >
            <div className="rounded-[2rem] bg-[linear-gradient(160deg,rgb(169_154_240/0.14),rgb(169_154_240/0.03))] p-6 sm:p-8">
              <p className="flex items-center gap-2 text-h3 font-semibold text-text-primary">
                <DeptDot id="operations" className="size-2.5" />
                {name('operations')}
              </p>
              <p className="mt-3 text-body text-text-secondary">{c.departments.roles.operations}</p>
            </div>
            <div className="space-y-3">
              {office.map((d) => (
                <div
                  key={d}
                  data-dept={d}
                  className="flex gap-3 rounded-2xl bg-white/[0.03] px-5 py-4"
                >
                  <DeptDot id={d} className="mt-1.5" />
                  <p className="text-label text-text-secondary">
                    <span className="font-semibold text-text-primary">{name(d)}</span> —{' '}
                    {c.departments.roles[d]}
                  </p>
                </div>
              ))}
              {(IND.optional ?? []).map((d) => (
                <div
                  key={d}
                  data-dept={d}
                  className="flex gap-3 rounded-2xl border border-dashed border-border-soft px-5 py-4"
                >
                  <DeptDot id={d} className="mt-1.5" />
                  <p className="text-label text-text-secondary">
                    <span className="font-semibold text-text-primary">{name(d)}</span>{' '}
                    <span className="text-caption text-text-muted">({s.common.optional})</span> —{' '}
                    {c.departments.roles[d]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Frame>
      </Chapter>

      {/* Signals as a status band, information beneath */}
      <Chapter id="signals" labelledBy="signals-title">
        <Frame width="wide">
          <Head id="signals-title" title={c.signals.title} />
          <ul
            className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-[1.75rem] bg-white/[0.05] sm:grid-cols-2 lg:grid-cols-4"
            data-signals={ID}
          >
            {IND.signals.map((sg) => (
              <li key={sg.id} data-signal={sg.id} className="bg-[rgb(8_17_25)] px-5 py-6">
                <ToneTag
                  tone={sg.tone}
                  label={s.industries[ID].signals[sg.id]!}
                  className="text-label"
                />
                <p className="mt-2 text-caption text-text-secondary">{c.signals.notes[sg.id]}</p>
              </li>
            ))}
          </ul>
          <div className="mt-14">
            <Kicker tone="muted">{c.information.title}</Kicker>
            <dl
              className="mt-5 grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3"
              data-information
            >
              {c.information.items.map((it) => (
                <div key={it.label}>
                  <dt className="text-label font-semibold text-text-primary">{it.label}</dt>
                  <dd className="mt-0.5 text-caption text-text-secondary">{it.why}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Frame>
      </Chapter>

      <Chapter id="fit" labelledBy="fit-title" plane="navy">
        <Frame width="base">
          <Head id="fit-title" title={c.fit.title} lead={c.fit.lead} />
          <PrincipleFit id={ID} variant="ledger" className="mt-10" />
          <Boundaries id={ID} className="mt-14" />
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
