import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Chapter, Frame } from '@/components/editorial/Layout';
import { LogoMark } from '@/components/brand/Logo';
import { companyName } from '@/config/company';
import { INSIGHT_PARTNER } from '@/config/partners';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { ABOUT_CHAPTER } from './model';
import { PARTNER, type PartnerCopy } from './partnerCopy';

/* ------------------------------------------------------------------ */
/* 07 Business & accounting insight — PDA BLISS × S2 (EP24.1)           */
/* ------------------------------------------------------------------ */

/*
 * A deliberate moment in the About story, not a logo strip: two fields of
 * expertise converging at CORE. The backdrop is split — a teal technology
 * grid on the PDA BLISS side, faint silver ledger rules on the S2 side —
 * and line bundles from both fields draw into one CORE node when the chapter
 * comes into view (static under reduced motion). On phones the same story
 * runs top to bottom: PDA BLISS → CORE → S2. A closing line states plainly
 * that they are separate companies.
 */

const TEAL = 'rgb(62 240 192)';
const SILVER = 'rgb(214 226 230)';

export function PartnerChapter() {
  const c = useCopy(PARTNER);
  const { locale } = useLocale();
  const reduce = usePrefersReducedMotion();
  const s2Name = locale === 'th' ? INSIGHT_PARTNER.legalNameTh : INSIGHT_PARTNER.legalName;
  // Thai stays on Thai pages (EN / ZH carry no Thai beyond the approved exceptions).
  const s2Secondary = locale === 'th' ? INSIGHT_PARTNER.legalName : INSIGHT_PARTNER.brand;
  const enter = (from: 'left' | 'right', delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, x: from === 'left' ? -28 : 28 },
          whileInView: { opacity: 1, x: 0 },
          viewport: { once: true, margin: '0px 0px -15% 0px' },
          transition: { duration: 0.7, ease: EASE_CORE, delay },
        };

  return (
    <Chapter
      id={ABOUT_CHAPTER.partner}
      labelledBy="business-insight-title"
      space="lg"
      className="overflow-hidden"
    >
      <Backdrop />
      <Frame width="full">
        {/* Heading — centred and larger than an ordinary chapter */}
        <header className="mx-auto max-w-4xl text-center">
          <p
            data-partner-label
            className="inline-flex items-center gap-3 rounded-full bg-white/[0.03] px-4 py-2 text-caption font-semibold text-[#d6e2e6] shadow-[inset_0_0_0_1px_rgb(214_226_230/0.22)]"
          >
            <span aria-hidden className="font-mono text-text-muted tabular">
              07
            </span>
            <span aria-hidden className="h-3 w-px bg-white/20" />
            {c.label}
          </p>
          <h2
            id="business-insight-title"
            className="mt-7 text-[clamp(2.25rem,1.4rem+3.6vw,4.75rem)] leading-[1.08] font-semibold tracking-tight text-balance"
          >
            <span className="bg-[linear-gradient(120deg,#b9f5e4,#3ef0c0_55%,#19c39a)] bg-clip-text text-transparent">
              {c.titleA}
            </span>
            <span aria-hidden className="mx-2 font-light text-text-muted sm:mx-4">
              ×
            </span>
            <span className="sr-only"> × </span>
            <span className="bg-[linear-gradient(120deg,#ffffff,#d6e2e6_55%,#9fb3ba)] bg-clip-text text-transparent">
              {c.titleB}
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-body leading-relaxed text-text-secondary sm:text-[1.0625rem]">
            {c.lead}
          </p>
        </header>

        {/* The convergence */}
        <div className="mt-16 grid items-center lg:mt-24 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,22rem)_minmax(0,1fr)]">
          <motion.div {...enter('left')} className="min-w-0">
            <Field
              data="pda"
              side="left"
              mark={
                <span className="grid size-20 place-items-center rounded-[1.5rem] bg-[linear-gradient(145deg,rgb(18_44_52),rgb(6_14_21))] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3),0_24px_60px_-30px_rgb(62_240_192/0.5)] sm:size-24">
                  <LogoMark className="size-12 sm:size-14" size="large" />
                </span>
              }
              name={companyName(locale)}
              secondary="PDA BLISS"
              field={c.pda.field}
              role={c.pda.role}
              points={c.pda.points}
            />
          </motion.div>

          <Convergence c={c} reduce={reduce} />

          <motion.div {...enter('right', 0.12)} className="min-w-0">
            <Field
              data="s2"
              side="right"
              mark={<S2Mark alt={c.logoAlt} />}
              name={s2Name}
              secondary={s2Secondary}
              field={c.s2.field}
              role={c.s2.role}
              points={c.s2.points}
              action={
                <a
                  href={INSIGHT_PARTNER.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-partner-link
                  className="mt-8 inline-flex min-h-12 items-center gap-2.5 rounded-full bg-[linear-gradient(120deg,#f4f7f8,#d6e2e6)] px-6 text-label font-semibold text-[#06121b] shadow-[0_18px_50px_-24px_rgb(214_226_230/0.6)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  {c.visit}
                  <ArrowUpRight aria-hidden className="size-4" />
                  <span className="sr-only">{c.external}</span>
                </a>
              }
            />
          </motion.div>
        </div>

        <p
          data-boundary
          className="mx-auto mt-16 max-w-3xl border-t border-white/[0.08] pt-6 text-center text-caption leading-relaxed text-text-muted lg:mt-24"
        >
          {c.boundary}
        </p>
      </Frame>
    </Chapter>
  );
}

/** The split field: teal grid (technology) on the left, silver ledger rules (accounting) on the right. */
function Backdrop() {
  return (
    <div aria-hidden className="absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,#040a10_12%,#040a10_88%,transparent)]" />
      <div className="absolute inset-y-0 left-0 w-1/2 bg-[radial-gradient(ellipse_70%_55%_at_30%_58%,rgb(25_195_154/0.13),transparent_70%)]" />
      <div className="absolute inset-y-0 left-0 w-1/2 bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_35%_58%,black,transparent_75%)] opacity-30" />
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_70%_55%_at_70%_58%,rgb(214_226_230/0.07),transparent_70%)]" />
      <div className="absolute inset-y-0 right-0 w-1/2 [background-image:repeating-linear-gradient(to_bottom,rgb(214_226_230/0.07)_0_1px,transparent_1px_34px)] [mask-image:radial-gradient(ellipse_65%_55%_at_65%_58%,black,transparent_75%)]" />
    </div>
  );
}

/** One field of expertise. Mirrored on wide screens: each field leans toward CORE. */
function Field({
  data,
  side,
  mark,
  name,
  secondary,
  field,
  role,
  points,
  action,
}: {
  data: string;
  side: 'left' | 'right';
  mark: ReactNode;
  name: string;
  secondary: string;
  field: string;
  role: string;
  points: readonly string[];
  action?: ReactNode;
}) {
  const left = side === 'left';
  return (
    <article
      data-side={data}
      className={cn(
        'mx-auto flex max-w-xl flex-col items-center text-center lg:mx-0 lg:max-w-none',
        left ? 'lg:items-end lg:pr-8 lg:text-right' : 'lg:items-start lg:pl-8 lg:text-left',
      )}
    >
      {mark}
      <p
        className={cn(
          'mt-7 font-mono text-[0.6875rem] tracking-[0.2em] uppercase',
          left ? 'text-brand-glow' : 'text-[#d6e2e6]',
        )}
      >
        {field}
      </p>
      <h3 className="mt-3 text-[clamp(1.25rem,1rem+0.8vw,1.625rem)] leading-snug font-semibold break-words text-text-primary">
        <NameWords name={name} />
      </h3>
      <p className="mt-1 text-caption break-words text-text-muted">{secondary}</p>
      <p className="mt-4 text-label font-medium text-text-secondary">{role}</p>
      {/* A left-aligned list on phones (centred block); mirrored toward CORE on wide screens. */}
      <ul className="mt-5 w-fit max-w-full space-y-2.5 text-left lg:w-auto lg:text-[inherit]">
        {points.map((pt) => (
          <li
            key={pt}
            className={cn(
              'flex items-start gap-3 text-label leading-relaxed text-text-secondary',
              left && 'lg:flex-row-reverse',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'mt-[0.6em] size-1.5 shrink-0 rounded-full',
                left ? 'bg-brand-glow' : 'bg-[#d6e2e6]',
              )}
            />
            <span className="min-w-0">{pt}</span>
          </li>
        ))}
      </ul>
      {action}
    </article>
  );
}

/** The owner-supplied S2 logo on a light silver plate (its artwork is made for light ground), or the typographic fallback. */
function S2Mark({ alt }: { alt: string }) {
  const logo = INSIGHT_PARTNER.logo;
  if (!logo) {
    return (
      <span
        aria-hidden
        data-typographic-mark
        className="grid size-20 place-items-center rounded-[1.5rem] bg-[linear-gradient(145deg,#f4f7f8,#d6e2e6)] text-[1.75rem] font-semibold tracking-tight text-[#0b5e5a] sm:size-24"
      >
        {INSIGHT_PARTNER.brand}
      </span>
    );
  }
  return (
    <span
      data-partner-logo
      className="block rounded-[1.75rem] bg-[linear-gradient(160deg,#f6f9fa,#e3eaec)] p-1.5 shadow-[0_30px_80px_-40px_rgb(214_226_230/0.55),inset_0_0_0_1px_rgb(255_255_255/0.6)]"
    >
      <img
        src={logo.src}
        srcSet={`${logo.src} 1x, ${logo.src2x} 2x`}
        alt={alt}
        width={logo.size}
        height={logo.size}
        loading="lazy"
        decoding="async"
        className="block size-36 rounded-[1.375rem] object-contain sm:size-44 lg:size-48"
      />
    </span>
  );
}

const LEFT_PATHS = [
  'M0 70 C 70 70, 90 150, 160 150',
  'M0 150 L 160 150',
  'M0 230 C 70 230, 90 150, 160 150',
];
const RIGHT_PATHS = [
  'M320 70 C 250 70, 230 150, 160 150',
  'M320 150 L 160 150',
  'M320 230 C 250 230, 230 150, 160 150',
];

/**
 * The centre: three teal lines from the technology side and three silver
 * lines from the business side converge on one CORE node. Wide screens draw
 * them horizontally; phones and tablets show a vertical connector. Lines draw
 * once on entry; with reduced motion they are simply there.
 */
function Convergence({ c, reduce }: { c: PartnerCopy; reduce: boolean }) {
  const draw = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { pathLength: 0, opacity: 0 },
          whileInView: { pathLength: 1, opacity: 1 },
          viewport: { once: true, margin: '0px 0px -20% 0px' },
          transition: { duration: 1.1, ease: EASE_CORE, delay },
        };
  const node = (
    <span
      aria-hidden
      className="relative grid size-24 place-items-center rounded-full bg-[#050b12] font-mono text-[0.8125rem] font-semibold tracking-[0.22em] text-brand-glow shadow-[0_0_0_8px_rgb(4_10_16),inset_0_0_0_1px_rgb(62_240_192/0.5),0_0_80px_-12px_rgb(62_240_192/0.45)]"
    >
      <span className="absolute inset-2 rounded-full shadow-[inset_0_0_0_1px_rgb(214_226_230/0.18)]" />
      {c.bridge.core}
    </span>
  );
  return (
    <div data-bridge className="flex flex-col items-center py-10 text-center lg:py-0">
      {/* Wide screens: horizontal convergence with the node at its centre */}
      <div className="relative hidden w-full max-w-[22rem] lg:block">
        <svg aria-hidden viewBox="0 0 320 300" className="h-auto w-full" fill="none">
          {LEFT_PATHS.map((d, i) => (
            <motion.path
              key={d}
              d={d}
              stroke={TEAL}
              strokeOpacity={i === 1 ? 0.7 : 0.35}
              strokeWidth={i === 1 ? 1.5 : 1}
              {...draw(0.15 + i * 0.12)}
            />
          ))}
          {RIGHT_PATHS.map((d, i) => (
            <motion.path
              key={d}
              d={d}
              stroke={SILVER}
              strokeOpacity={i === 1 ? 0.7 : 0.35}
              strokeWidth={i === 1 ? 1.5 : 1}
              {...draw(0.21 + i * 0.12)}
            />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center">{node}</div>
      </div>
      {/* Phones / tablets: teal from above, silver below */}
      <span
        aria-hidden
        className="h-14 w-px bg-[linear-gradient(to_bottom,transparent,rgb(62_240_192/0.7))] lg:hidden"
      />
      <div className="lg:hidden">{node}</div>
      <div className="mt-6 max-w-sm lg:mt-2">
        <p className="text-label font-semibold text-text-primary">{c.bridge.title}</p>
        <p className="mt-2 text-caption leading-relaxed text-text-secondary">{c.bridge.body}</p>
      </div>
      <span
        aria-hidden
        className="mt-6 h-14 w-px bg-[linear-gradient(to_bottom,rgb(214_226_230/0.7),transparent)] lg:hidden"
      />
    </div>
  );
}

/** A company name that wraps only between its words (Thai would otherwise break mid-word). */
function NameWords({ name }: { name: string }) {
  const words = name.split(' ');
  return words.map((w, i) => (
    <Fragment key={i}>
      <span className="inline-block whitespace-nowrap">{w}</span>
      {i < words.length - 1 && ' '}
    </Fragment>
  ));
}
