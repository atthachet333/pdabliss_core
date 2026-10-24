import { motion, useInView, useTransform, type MotionValue } from 'framer-motion';
import { Check, Copy, X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { Chapter, Frame } from '@/components/editorial/Layout';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { Lines, QuietLink, StoryHead } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { cn } from '@/lib/cn';
import { Reveal } from '@/motion/Reveal';
import { ABOUT } from './copy';
import { ABOUT_CHAPTER, ABOUT_LINKS, PRINCIPLES, SYMPTOMS, type Principle } from './model';
import { useSceneScroll } from './motion';
import { ABOUT_SCENES } from './scenes/copy';
import { DefenseRings } from './scenes/DefenseRings';
import { SystemShift } from './scenes/SystemShift';

const num = (i: number) => String(i + 1).padStart(2, '0');

/* ------------------------------------------------------------------ */
/* 01 PDA BLISS — the company → product lockup                          */
/* ------------------------------------------------------------------ */

export function CompanyChapter() {
  const c = useCopy(ABOUT).company;
  const s = useCopy(ABOUT_SCENES);
  return (
    <Chapter id={ABOUT_CHAPTER.company} labelledBy="company-title" space="lg">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-20">
          <StoryHead
            index="01"
            ghost
            notation={s.notation.company}
            kicker={c.kicker}
            id="company-title"
            title={c.title}
          />
          <div className="lg:pt-12">
            <Reveal>
              <p className="text-[clamp(1.0625rem,0.95rem+0.4vw,1.3125rem)] leading-[1.85] text-text-secondary">
                {c.body}
              </p>
            </Reveal>
            <p className="mt-12 text-caption font-semibold text-text-muted">{c.relationTitle}</p>
            {/* Parent → product lockup */}
            <dl data-relation className="mt-5">
              <div data-relation-item="company">
                <dt className="text-[clamp(1.75rem,1.3rem+1.6vw,2.5rem)] leading-none font-semibold tracking-[0.06em] text-text-primary">
                  {c.relation.company.name}
                </dt>
                <dd className="mt-2 text-label text-text-secondary">{c.relation.company.role}</dd>
              </div>
              <div aria-hidden className="ml-3 flex items-center gap-3 py-3">
                <span className="h-12 w-px bg-[linear-gradient(to_bottom,rgb(190_235_222/0.4),rgb(62_240_192/0.9))]" />
                <span className="font-mono text-[0.6875rem] text-text-muted">
                  {s.lockup.makes} ↓
                </span>
              </div>
              <div
                data-relation-item="product"
                className="rounded-2xl bg-brand-primary/[0.06] px-5 py-4 shadow-[inset_0_0_0_1px_rgb(62_240_192/0.25)]"
              >
                <dt className="text-[clamp(1.5rem,1.2rem+1.1vw,2rem)] leading-none font-semibold tracking-[0.18em] text-brand-glow">
                  {c.relation.product.name}
                </dt>
                <dd className="mt-2 text-label text-text-secondary">{c.relation.product.role}</dd>
              </div>
            </dl>
            <p className="mt-5 text-label text-text-muted">{c.relationNote}</p>
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 02 What we believe — lines lock into place as they are read          */
/* ------------------------------------------------------------------ */

function ManifestoLine({ p, i }: { p: Principle; i: number }) {
  const c = useCopy(ABOUT).belief;
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLLIElement>(null);
  const reached = useInView(ref, { once: true, margin: '0px 0px -42% 0px' });
  const active = useInView(ref, { margin: '-38% 0px -38% 0px' });
  const locked = reduce || reached;
  return (
    <li
      ref={ref}
      data-principle={p}
      data-locked={locked || undefined}
      data-active={active || undefined}
      className={cn(
        'relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 border-t py-7 transition-[opacity,translate,border-color] duration-700 sm:py-9',
        locked ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-45',
        active ? 'border-brand-glow/60' : 'border-border-soft',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pt-1.5 text-caption tabular',
          active ? 'text-brand-glow' : 'text-text-muted',
        )}
      >
        {num(i + 1)}
      </span>
      <div>
        <h3
          className={cn(
            'flex items-start gap-3 text-[clamp(1.25rem,1.05rem+0.9vw,1.875rem)] leading-[1.35] font-semibold transition-colors duration-700',
            locked ? 'text-text-primary' : 'text-text-muted',
          )}
        >
          {c.principles[p].title}
          <Check
            aria-hidden
            className={cn(
              'mt-2 size-4 shrink-0 text-brand-glow transition-opacity duration-500',
              locked ? 'opacity-100' : 'opacity-0',
            )}
          />
        </h3>
        <p className="mt-2 max-w-lg text-label text-text-secondary">{c.principles[p].body}</p>
      </div>
    </li>
  );
}

export function BeliefChapter() {
  const c = useCopy(ABOUT).belief;
  const s = useCopy(ABOUT_SCENES);
  const [lead, ...rest] = PRINCIPLES;
  return (
    <Chapter id={ABOUT_CHAPTER.belief} labelledBy="belief-title" plane="navy" space="lg">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <StoryHead
              index="02"
              ghost
              notation={s.notation.belief}
              kicker={c.kicker}
              id="belief-title"
              title={c.title}
              size="quiet"
            />
            <div data-principle={lead} data-lead className="mt-14">
              <p aria-hidden className="text-caption text-text-muted tabular">
                01
              </p>
              <h3 className="mt-3 text-gradient-brand text-[clamp(2rem,1.2rem+3vw,3.75rem)] leading-[1.15] font-semibold tracking-tight">
                <Lines text={c.principles[lead].title} />
              </h3>
              <p className="mt-5 max-w-md text-body-lg text-text-secondary">
                {c.principles[lead].body}
              </p>
            </div>
          </div>
          <ol data-manifesto className="lg:pt-40" start={2}>
            {rest.map((p, i) => (
              <ManifestoLine key={p} p={p} i={i} />
            ))}
          </ol>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 03 The operational problem — physical, slightly wrong                */
/* ------------------------------------------------------------------ */

/** Each slip's resting turn, offset (lg) and how far it drifts with scroll. */
const SLIP = [
  { turn: -2.2, shift: '', drift: 10 },
  { turn: 1.6, shift: 'lg:translate-x-6 lg:translate-y-6', drift: -14 },
  { turn: 1.1, shift: 'lg:-translate-x-2', drift: 8 },
  { turn: -1.4, shift: 'lg:translate-x-8 lg:translate-y-3', drift: -10 },
  { turn: -0.8, shift: 'lg:translate-x-3', drift: 12 },
  { turn: 2, shift: 'lg:-translate-x-1 lg:translate-y-5', drift: -8 },
  { turn: -1.2, shift: 'lg:translate-x-10', drift: 6 },
];

function Slip({ i, p, children }: { i: number; p: MotionValue<number>; children: ReactNode }) {
  const s = SLIP[i]!;
  // Notes drift slightly out of alignment as the page moves.
  const y = useTransform(p, [0, 1], [s.drift, -s.drift]);
  const rotate = useTransform(p, [0, 1], [s.turn, s.turn * 1.6]);
  return (
    <motion.li
      data-symptom={SYMPTOMS[i]}
      style={{ y, rotate }}
      className={cn(
        'rounded-xl bg-[#11171c]/90 px-5 py-4 shadow-[inset_0_0_0_1px_rgb(245_184_75/0.14),0_24px_50px_-30px_rgb(0_0_0/0.9)]',
        s.shift,
        i === SYMPTOMS.length - 1 && 'sm:col-span-2 sm:mx-auto sm:w-[70%]',
      )}
    >
      {children}
    </motion.li>
  );
}

function Evidence() {
  const e = useCopy(ABOUT_SCENES).problem;
  return (
    <figure
      aria-label={e.evidenceLabel}
      data-evidence
      className="m-0 mt-14 rounded-2xl border border-dashed border-warning/25 p-5 sm:p-6"
    >
      <figcaption className="text-caption font-semibold text-warning/90">
        {e.evidenceLabel}
      </figcaption>
      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {/* Status labels disagree */}
        <div data-disagree>
          <p className="text-caption text-text-muted tabular">{e.record}</p>
          <p className="mt-2 flex items-center gap-2 text-label text-text-primary">
            <Check aria-hidden className="size-3.5 text-success" />
            {e.a.who}: {e.a.state}
          </p>
          <p className="mt-1 flex items-center gap-2 text-label text-text-primary">
            <X aria-hidden className="size-3.5 text-danger" />
            {e.b.who}: {e.b.state}
          </p>
        </div>
        {/* Duplicate data, offset */}
        <div data-duplicate>
          <p className="text-caption text-text-muted">{e.dupNote}</p>
          <div className="relative mt-2 h-14">
            <span
              aria-hidden
              className="absolute top-2 left-2 rounded-lg bg-white/[0.03] px-3 py-1.5 text-label text-text-muted"
            >
              {e.dup}
            </span>
            <span className="absolute top-0 left-0 inline-flex items-center gap-2 rounded-lg bg-[#11171c] px-3 py-1.5 text-label text-text-primary shadow-[inset_0_0_0_1px_rgb(245_184_75/0.25)]">
              <Copy aria-hidden className="size-3.5 text-warning" />
              {e.dup}
            </span>
          </div>
        </div>
        {/* One thread fails to connect */}
        <div data-broken>
          <p className="text-caption text-text-muted">{e.broken}</p>
          <svg viewBox="0 0 200 40" className="mt-2 h-10 w-full max-w-52" aria-hidden>
            <circle cx="10" cy="20" r="6" fill="#f5b84b" fillOpacity="0.8" />
            <path
              d="M 18 20 C 60 4, 100 36, 140 20"
              fill="none"
              stroke="#f5b84b"
              strokeOpacity="0.6"
              strokeDasharray="4 4"
            />
            <path
              d="M 146 14 l 10 12 m 0 -12 l -10 12"
              stroke="#f47272"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="188" cy="20" r="6" fill="none" stroke="#a3b8b2" strokeOpacity="0.5" />
          </svg>
        </div>
      </div>
    </figure>
  );
}

export function ProblemChapter() {
  const c = useCopy(ABOUT).problem;
  const s = useCopy(ABOUT_SCENES);
  const ref = useRef<HTMLDivElement>(null);
  const p = useSceneScroll(ref, ['start end', 'end start']);
  return (
    <Chapter id={ABOUT_CHAPTER.problem} labelledBy="problem-title" space="lg">
      <Frame width="wide">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <StoryHead
              index="03"
              ghost
              notation={s.notation.problem}
              kicker={c.kicker}
              id="problem-title"
              title={c.title}
              lead={c.lead}
            />
            <QuietLink to={ABOUT_LINKS.solutions} data="solutions" className="mt-8">
              {c.link}
            </QuietLink>
          </div>

          <div ref={ref} className="relative">
            {/* Broken threads between the fragments — one never arrives */}
            <svg
              aria-hidden
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 -z-10 hidden size-full sm:block"
            >
              {['M 22 10 L 70 22', 'M 30 30 L 72 46', 'M 26 52 L 66 68', 'M 30 74 L 58 84'].map(
                (d) => (
                  <path
                    key={d}
                    d={d}
                    stroke="#f5b84b"
                    strokeOpacity="0.3"
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
              {SYMPTOMS.map((sy, i) => (
                <Slip key={sy} i={i} p={p}>
                  <p className="flex items-baseline gap-2.5 text-label font-semibold text-text-primary">
                    <span aria-hidden className="text-caption font-normal text-warning/80 tabular">
                      {num(i)}
                    </span>
                    {c.symptoms[sy].title}
                  </p>
                  <p className="mt-1.5 text-caption text-text-secondary">{c.symptoms[sy].body}</p>
                </Slip>
              ))}
            </ul>
            <Evidence />
          </div>
        </div>
      </Frame>
    </Chapter>
  );
}

/* ------------------------------------------------------------------ */
/* 04 How we think about systems — and Human Error by design            */
/* ------------------------------------------------------------------ */

export function SystemsChapter() {
  const c = useCopy(ABOUT).systems;
  const s = useCopy(ABOUT_SCENES);
  return (
    <Chapter id={ABOUT_CHAPTER.systems} labelledBy="systems-title" plane="grid" space="lg">
      <Frame width="wide">
        <StoryHead
          index="04"
          ghost
          notation={s.notation.systems}
          kicker={c.kicker}
          id="systems-title"
          title={c.title}
        />
        <SystemShift />
        <p className="mt-8 max-w-3xl border-l-2 border-brand-primary/40 pl-4 text-label text-text-secondary">
          {c.note}
        </p>
        <DefenseRings />
      </Frame>
    </Chapter>
  );
}
