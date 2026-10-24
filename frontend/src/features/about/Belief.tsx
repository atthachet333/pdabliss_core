import { ArrowDown, ArrowRight } from 'lucide-react';
import { Chapter, Frame, Kicker } from '@/components/editorial/Layout';
import { DEPT_PAGES } from '@/features/departments/catalog';
import { DeptDot, Lines, QuietLink, StoryHead } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { Reveal } from '@/motion/Reveal';
import { ABOUT } from './copy';
import { ABOUT_CHAPTER, ABOUT_LINKS, GUARDS, PRINCIPLES, SYMPTOMS } from './model';

const num = (i: number) => String(i + 1).padStart(2, '0');

/* ------------------------------------------------------------------ */
/* 01 PDA BLISS — the company, and its relationship to CORE             */
/* ------------------------------------------------------------------ */

export function CompanyChapter() {
  const c = useCopy(ABOUT).company;
  return (
    <Chapter id={ABOUT_CHAPTER.company} labelledBy="company-title" space="lg">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-20">
          <StoryHead index="01" kicker={c.kicker} id="company-title" title={c.title} />
          <div className="lg:pt-12">
            <Reveal>
              <p className="text-[clamp(1.0625rem,0.95rem+0.4vw,1.3125rem)] leading-[1.85] text-text-secondary">
                {c.body}
              </p>
            </Reveal>
            <p className="mt-12 text-caption font-semibold text-text-muted">{c.relationTitle}</p>
            <dl data-relation className="mt-4 border-t border-border-soft">
              {(['company', 'product'] as const).map((k) => (
                <div
                  key={k}
                  data-relation-item={k}
                  className="grid grid-cols-1 gap-1 border-b border-border-soft py-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6"
                >
                  <dt
                    className={cn(
                      'text-h3 tracking-[0.04em]',
                      k === 'product' ? 'text-brand-glow' : 'text-text-primary',
                    )}
                  >
                    {c.relation[k].name}
                  </dt>
                  <dd className="text-label text-text-secondary sm:pt-1">{c.relation[k].role}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-label text-text-muted">{c.relationNote}</p>
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 02 What we believe — a manifesto, not a card wall                    */
/* ------------------------------------------------------------------ */

export function BeliefChapter() {
  const c = useCopy(ABOUT).belief;
  const [lead, ...rest] = PRINCIPLES;
  return (
    <Chapter id={ABOUT_CHAPTER.belief} labelledBy="belief-title" plane="navy" space="lg">
      <Frame width="wide">
        <StoryHead index="02" kicker={c.kicker} id="belief-title" title={c.title} size="quiet" />

        <Reveal>
          <div data-principle={lead} data-lead className="mt-20 max-w-5xl lg:mt-28">
            <p aria-hidden className="text-caption text-text-muted tabular">
              01
            </p>
            <h3 className="mt-3 text-gradient-brand text-[clamp(2rem,1.2rem+3.2vw,4.25rem)] leading-[1.15] font-semibold tracking-tight">
              <Lines text={c.principles[lead].title} />
            </h3>
            <p className="mt-6 max-w-2xl text-body-lg text-text-secondary">
              {c.principles[lead].body}
            </p>
          </div>
        </Reveal>

        <ol
          data-manifesto
          className="mt-20 grid grid-cols-1 gap-x-20 md:grid-cols-2 lg:mt-24"
          start={2}
        >
          {rest.map((p, i) => (
            <li
              key={p}
              data-principle={p}
              className={cn(
                'grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 border-t border-border-soft py-7 sm:py-8',
                // The second column steps down: a reading rhythm, not a grid of equals.
                i % 2 === 1 && 'md:translate-y-16',
              )}
            >
              <span aria-hidden className="pt-1.5 text-caption text-text-muted tabular">
                {num(i + 1)}
              </span>
              <div>
                <h3 className="text-[clamp(1.1875rem,1.05rem+0.6vw,1.625rem)] leading-[1.4] font-semibold text-text-primary">
                  {c.principles[p].title}
                </h3>
                <p className="mt-2 max-w-md text-label text-text-secondary">
                  {c.principles[p].body}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div aria-hidden className="hidden h-16 md:block" />
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 03 The operational problem — fragments, not a lack of software       */
/* ------------------------------------------------------------------ */

/** Each slip's resting turn and offset — scattered on purpose. */
const SLIP = [
  { turn: -2.2, shift: '' },
  { turn: 1.6, shift: 'lg:translate-x-6 lg:translate-y-6' },
  { turn: 1.1, shift: 'lg:-translate-x-2' },
  { turn: -1.4, shift: 'lg:translate-x-8 lg:translate-y-3' },
  { turn: -0.8, shift: 'lg:translate-x-3' },
  { turn: 2, shift: 'lg:-translate-x-1 lg:translate-y-5' },
  { turn: -1.2, shift: 'lg:translate-x-10' },
];

export function ProblemChapter() {
  const c = useCopy(ABOUT).problem;
  return (
    <Chapter id={ABOUT_CHAPTER.problem} labelledBy="problem-title" space="lg">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <StoryHead
              index="03"
              kicker={c.kicker}
              id="problem-title"
              title={c.title}
              lead={c.lead}
            />
            <QuietLink to={ABOUT_LINKS.solutions} data="solutions" className="mt-8">
              {c.link}
            </QuietLink>
          </div>

          <div className="relative">
            {/* Broken threads between the fragments */}
            <svg
              aria-hidden
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 -z-10 hidden size-full sm:block"
            >
              {['M 22 10 L 70 22', 'M 30 30 L 72 46', 'M 26 52 L 66 68', 'M 30 74 L 70 90'].map(
                (d) => (
                  <path
                    key={d}
                    d={d}
                    stroke="#f5b84b"
                    strokeOpacity="0.28"
                    strokeWidth="0.25"
                    strokeDasharray="1.2 2.4"
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                  />
                ),
              )}
            </svg>
            <ul
              data-symptoms
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-8"
            >
              {SYMPTOMS.map((s, i) => (
                <li
                  key={s}
                  data-symptom={s}
                  style={{ rotate: `${SLIP[i]!.turn}deg` }}
                  className={cn(
                    'rounded-xl bg-[#11171c]/90 px-5 py-4 shadow-[inset_0_0_0_1px_rgb(245_184_75/0.14),0_24px_50px_-30px_rgb(0_0_0/0.9)]',
                    SLIP[i]!.shift,
                    i === SYMPTOMS.length - 1 && 'sm:col-span-2 sm:mx-auto sm:w-[70%]',
                  )}
                >
                  <p className="flex items-baseline gap-2.5 text-label font-semibold text-text-primary">
                    <span aria-hidden className="text-caption font-normal text-warning/80 tabular">
                      {num(i)}
                    </span>
                    {c.symptoms[s].title}
                  </p>
                  <p className="mt-1.5 text-caption text-text-secondary">{c.symptoms[s].body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 04 How we think about systems                                        */
/* ------------------------------------------------------------------ */

function Path({
  kind,
  label,
  steps,
}: {
  kind: 'traditional' | 'core';
  label: string;
  steps: readonly string[];
}) {
  const core = kind === 'core';
  return (
    <div data-path={kind}>
      <Kicker tone={core ? 'clear' : 'muted'}>{label}</Kicker>
      <ol
        className={cn(
          'mt-5 flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-0',
          !core &&
            'rounded-2xl bg-white/[0.025] p-3 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.07)]',
        )}
      >
        {steps.map((s, i) => (
          <li key={s} className="flex flex-col items-start lg:flex-1 lg:flex-row lg:items-center">
            <span
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl px-4 py-3.5 text-label lg:h-full',
                core
                  ? i === steps.length - 1
                    ? 'bg-brand-primary/15 font-semibold text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.35)]'
                    : 'bg-white/[0.04] text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.16)]'
                  : 'text-text-secondary',
              )}
            >
              {core && i === 1 && (
                <span aria-hidden className="flex gap-1">
                  {DEPT_PAGES.map((d) => (
                    <DeptDot key={d} id={d} className="size-1.5" />
                  ))}
                </span>
              )}
              {s}
            </span>
            {i < steps.length - 1 && (
              <>
                <ArrowDown
                  aria-hidden
                  className={cn(
                    'my-1 ml-4 size-4 lg:hidden',
                    core ? 'text-brand-glow' : 'text-text-muted',
                  )}
                />
                <ArrowRight
                  aria-hidden
                  className={cn(
                    'mx-2 hidden size-4 shrink-0 lg:block',
                    core ? 'text-brand-glow' : 'text-text-muted',
                  )}
                />
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SystemsChapter() {
  const c = useCopy(ABOUT).systems;
  return (
    <Chapter id={ABOUT_CHAPTER.systems} labelledBy="systems-title" plane="grid" space="lg">
      <Frame width="wide">
        <StoryHead index="04" kicker={c.kicker} id="systems-title" title={c.title} />
        <div className="mt-14 space-y-10">
          <Path kind="traditional" label={c.traditional.label} steps={c.traditional.steps} />
          <Path kind="core" label={c.core.label} steps={c.core.steps} />
        </div>
        <p className="mt-8 max-w-3xl border-l-2 border-brand-primary/40 pl-4 text-label text-text-secondary">
          {c.note}
        </p>

        <div
          data-human-error
          className="mt-24 grid grid-cols-1 gap-12 border-t border-border-soft pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20"
        >
          <div>
            <h3 className="text-[clamp(1.5rem,1.15rem+1.3vw,2.25rem)] leading-[1.3] font-semibold text-text-primary">
              <Lines text={c.humanError.title} />
            </h3>
            <p className="mt-5 max-w-lg text-body text-text-secondary">{c.humanError.body}</p>
            <QuietLink to={ABOUT_LINKS.howCoreWorks} data="how-core-works" className="mt-6">
              {c.link}
            </QuietLink>
          </div>
          <dl className="divide-y divide-border-soft border-y border-border-soft">
            {GUARDS.map((g) => (
              <div
                key={g.id}
                data-guard={g.id}
                className="flex items-baseline justify-between gap-6 py-4"
              >
                <dt className="text-h3 text-text-primary">{c.humanError.guards[g.id]}</dt>
                <dd className="text-caption font-semibold tracking-[0.24em] text-brand-glow">
                  {g.principle}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Frame>
    </Chapter>
  );
}
