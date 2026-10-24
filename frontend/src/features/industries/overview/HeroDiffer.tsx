import { motion } from 'framer-motion';
import { ArrowRight, Check, Repeat } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Chapter, Frame, Kicker, Stage } from '@/components/editorial/Layout';
import { Segmented } from '@/components/ui/Segmented';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { INDUSTRIES_SUMMARY } from '../copy/summary';
import {
  CHANGES,
  INDUSTRIES,
  INDUSTRY_IDS,
  industryPath,
  STAYS,
  type IndustryId,
  type Motif,
} from '../model';
import { Head, MotifGlyph } from '../parts';

/* ------------------------------------------------------------------ */
/* Hero — CORE at the centre, six environment windows around it         */
/* ------------------------------------------------------------------ */

/** Each window carries its environment's pattern, not a colour. */
const PATTERN: Record<Motif, string> = {
  network:
    'bg-[radial-gradient(circle,rgb(190_235_222/0.14)_1px,transparent_1.5px)] [background-size:14px_14px]',
  schedule:
    'bg-[linear-gradient(rgb(190_235_222/0.08)_1px,transparent_1px)] [background-size:100%_16px]',
  milestones:
    'bg-[repeating-linear-gradient(90deg,rgb(190_235_222/0.08)_0,rgb(190_235_222/0.08)_1px,transparent_1px,transparent_28px)]',
  branches: 'bg-[radial-gradient(circle_at_50%_50%,rgb(62_240_192/0.1),transparent_60%)]',
  sites:
    'bg-[linear-gradient(0deg,rgb(190_235_222/0.08)_1px,transparent_1px),linear-gradient(90deg,rgb(190_235_222/0.08)_1px,transparent_1px)] [background-size:22px_22px]',
  lanes:
    'bg-[repeating-linear-gradient(0deg,transparent_0,transparent_15px,rgb(190_235_222/0.09)_15px,rgb(190_235_222/0.09)_16px)]',
};

/** Window positions around the centre (percent of the figure). */
const SPOTS: Record<IndustryId, { x: number; y: number }> = {
  distribution: { x: 21, y: 15 },
  services: { x: 79, y: 15 },
  projects: { x: 17, y: 50 },
  retail: { x: 83, y: 50 },
  property: { x: 21, y: 85 },
  manufacturing: { x: 79, y: 85 },
};

function EnvironmentOrbit() {
  const c = useCopy(INDUSTRIES_SUMMARY);
  const { href } = useLocale();
  const reduce = usePrefersReducedMotion();
  return (
    <figure aria-label={c.hero.visual} data-hero-orbit className="relative">
      {/* Wide screens: windows around CORE */}
      <div className="relative hidden aspect-[1.25] w-full md:block">
        <svg
          aria-hidden
          viewBox="0 0 100 80"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
        >
          {INDUSTRY_IDS.map((id) => (
            <line
              key={id}
              x1="50"
              y1="40"
              x2={SPOTS[id].x}
              y2={SPOTS[id].y * 0.8}
              stroke="var(--color-brand-glow)"
              strokeOpacity="0.28"
              strokeWidth="0.25"
              strokeDasharray="0.8 1.2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <div className="absolute top-1/2 left-1/2 flex size-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-surface-raised shadow-[0_0_0_1px_rgb(62_240_192/0.5),0_0_70px_rgb(62_240_192/0.25)]">
          <span className="text-body font-semibold text-text-primary">CORE</span>
          <span className="mt-0.5 h-px w-8 bg-brand-glow/60" />
        </div>
        {INDUSTRY_IDS.map((id, i) => (
          <motion.div
            key={id}
            className="absolute w-[34%] max-w-[13rem] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${SPOTS[id].x}%`, top: `${SPOTS[id].y}%` }}
            {...(reduce
              ? {}
              : {
                  initial: { opacity: 0, scale: 0.94 },
                  animate: { opacity: 1, scale: 1 },
                  transition: { delay: 0.2 + i * 0.12, duration: 0.6, ease: EASE_CORE },
                })}
          >
            <Link
              to={href(industryPath(id))}
              data-orbit-industry={id}
              className={cn(
                'group flex min-h-24 flex-col justify-between overflow-hidden rounded-2xl bg-surface-base/85 p-3.5 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)] transition-shadow hover:shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4)]',
                PATTERN[INDUSTRIES[id].motif],
              )}
            >
              <MotifGlyph motif={INDUSTRIES[id].motif} className="h-9 w-14 text-brand-soft" />
              <span className="mt-2 flex items-center justify-between gap-2 text-label font-medium text-text-primary">
                {c.industries[id].short}
                <ArrowRight
                  aria-hidden
                  className="size-3.5 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
      {/* Phones: a compact field of the six environments */}
      <ul className="grid grid-cols-2 gap-2 md:hidden">
        {INDUSTRY_IDS.map((id) => (
          <li key={id}>
            <Link
              to={href(industryPath(id))}
              className={cn(
                'flex min-h-20 flex-col justify-between rounded-2xl bg-surface-base/85 p-3 shadow-[inset_0_0_0_1px_rgb(190_235_222/0.1)]',
                PATTERN[INDUSTRIES[id].motif],
              )}
            >
              <MotifGlyph motif={INDUSTRIES[id].motif} className="h-7 w-11 text-brand-soft" />
              <span className="mt-1 text-label font-medium text-text-primary">
                {c.industries[id].short}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function IndustriesHero() {
  const c = useCopy(INDUSTRIES_SUMMARY).hero;
  return (
    <section aria-labelledby="industries-title" className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_55%_60%_at_72%_40%,rgb(62_224_180/0.09),transparent_70%)]"
      />
      <Frame width="wide" className="pt-28 pb-20 sm:pt-32 lg:pt-36 lg:pb-28">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)] lg:gap-14">
          <div>
            <Kicker tone="clear">{c.eyebrow}</Kicker>
            <h1
              id="industries-title"
              className="mt-5 text-[clamp(2rem,1.1rem+3vw,3.6rem)] leading-[1.2] font-semibold tracking-tight text-text-primary"
            >
              {c.title.split('\n').map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </h1>
            <p className="mt-7 max-w-xl border-l-2 border-brand-primary/50 pl-5 text-body-lg text-text-secondary">
              {c.lead}
            </p>
          </div>
          <EnvironmentOrbit />
        </div>
      </Frame>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 01 Why industries differ — what stays, what changes                  */
/* ------------------------------------------------------------------ */

export function DifferChapter() {
  const c = useCopy(INDUSTRIES_SUMMARY);
  const d = c.differ;
  const [id, setId] = useState<IndustryId>('distribution');
  return (
    <Chapter id="why" labelledBy="why-title" plane="navy" space="lg">
      <Frame width="wide">
        <Head id="why-title" eyebrow={d.eyebrow} title={d.title} lead={d.lead} />

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)] lg:gap-8">
          {/* What stays — solid, unchanging */}
          <div data-stays className="rounded-[2rem] bg-white/[0.03] p-6 sm:p-8">
            <Kicker tone="clear">{d.staysTitle}</Kicker>
            <ul className="mt-6 space-y-3">
              {STAYS.map((s) => (
                <li key={s} className="flex items-center gap-3 text-body text-text-primary">
                  <span
                    aria-hidden
                    className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-primary/20"
                  >
                    <Check className="size-3 text-brand-glow" />
                  </span>
                  {d.stays[s]}
                </li>
              ))}
            </ul>
          </div>

          {/* What changes — follows the chosen industry */}
          <Stage glow="clear" className="p-5 sm:p-8">
            <div className="flex flex-col gap-4">
              <p className="flex items-center gap-2 text-caption font-semibold text-warning">
                <Repeat aria-hidden className="size-3.5" />
                {d.changesTitle}
              </p>
              <Segmented
                label={d.pick}
                options={INDUSTRY_IDS.map((x) => ({ value: x, label: c.industries[x].short }))}
                value={id}
                onChange={setId}
                size="sm"
                className="grid w-full grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
              />
            </div>
            <dl
              data-changes={id}
              aria-live="polite"
              className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-white/[0.05] sm:grid-cols-2"
            >
              {CHANGES.map((k) => (
                <div key={k} data-change={k} className="bg-[rgb(9_19_28)] px-5 py-4">
                  <dt className="text-caption text-text-muted">{d.changes[k]}</dt>
                  <dd className="mt-1 text-label text-text-primary">
                    {c.industries[id].changes[k]}
                  </dd>
                </div>
              ))}
            </dl>
          </Stage>
        </div>
      </Frame>
    </Chapter>
  );
}
