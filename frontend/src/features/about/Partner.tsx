import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Chapter, Frame } from '@/components/editorial/Layout';
import { LogoMark } from '@/components/brand/Logo';
import { companyName } from '@/config/company';
import { INSIGHT_PARTNER } from '@/config/partners';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { ABOUT_CHAPTER, ABOUT_LINKS } from './model';
import { PARTNER, type PartnerCopy } from './partnerCopy';

/* ------------------------------------------------------------------ */
/* 07 Business & accounting insight — PDA BLISS × S2 (EP24.1)           */
/* ------------------------------------------------------------------ */

/*
 * A deliberate moment in the About story, not a logo strip: two fields of
 * expertise converging at CORE. The backdrop is split — a teal technology
 * grid on the PDA BLISS side, faint silver ledger rules on the S2 side — and
 * line bundles from both fields draw into one CORE node (static under
 * reduced motion). A closing line states plainly that they are separate
 * companies.
 *
 * EP24.1.4 — composition, not margins. On wide screens the chapter is one
 * symmetric grid, `1fr | connector (≈ 200–240 px) | 1fr`, whose rows are
 * shared by both sides (CSS subgrid): logo zone, field label, company name,
 * secondary name, role, points and action line up across the two companies
 * whatever the language or name length. Both logos sit on plates of the same
 * size at the inner edge of their side, so the connector lines start and end
 * at the same distance from each logo and the CORE node sits exactly on the
 * logos' centre line. On phones the story runs top to bottom: PDA BLISS →
 * CORE → S2.
 */

const TEAL = 'rgb(62 240 192)';
const SILVER = 'rgb(214 226 230)';

/** Shared rows: mark · field · name · secondary · role · points · action. */
const ROWS = 'lg:row-span-7 lg:grid lg:grid-rows-subgrid';

export function PartnerChapter() {
  const c = useCopy(PARTNER);
  const { locale, href } = useLocale();
  const reduce = usePrefersReducedMotion();
  const s2Name = locale === 'th' ? INSIGHT_PARTNER.legalNameTh : INSIGHT_PARTNER.legalName;
  // Thai stays on Thai pages (EN / ZH carry no Thai beyond the approved exceptions).
  const s2Secondary = locale === 'th' ? INSIGHT_PARTNER.legalName : INSIGHT_PARTNER.brand;
  const enter = (from: 'left' | 'right') =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, x: from === 'left' ? -24 : 24 },
          whileInView: { opacity: 1, x: 0 },
          viewport: { once: true, margin: '0px 0px -15% 0px' },
          // Both sides arrive together: neither company comes "first".
          transition: { duration: 0.7, ease: EASE_CORE },
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

        {/* The convergence: 1fr | connector | 1fr, rows shared by both sides */}
        <div
          data-partner-grid
          className="mx-auto mt-16 grid max-w-[78rem] lg:mt-24 lg:grid-cols-[minmax(0,1fr)_clamp(12.5rem,18vw,15rem)_minmax(0,1fr)] lg:grid-rows-[auto_auto_auto_auto_auto_1fr_auto]"
        >
          <Field
            data="pda"
            side="left"
            motionProps={enter('left')}
            mark={<PdaMark />}
            name={companyName(locale)}
            secondary="PDA BLISS"
            field={c.pda.field}
            role={c.pda.role}
            points={c.pda.points}
            action={
              <Link
                to={href(ABOUT_LINKS.howCoreWorks)}
                data-partner-action="pda"
                className={cn(
                  ACTION,
                  'text-brand-soft shadow-[inset_0_0_0_1px_rgb(62_240_192/0.45)] hover:bg-brand-primary/[0.08]',
                )}
              >
                {c.pdaAction}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            }
          />

          <Convergence c={c} reduce={reduce} />

          <Field
            data="s2"
            side="right"
            motionProps={enter('right')}
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
                data-partner-action="s2"
                className={cn(
                  ACTION,
                  'text-[#e8eff1] shadow-[inset_0_0_0_1px_rgb(214_226_230/0.5)] hover:bg-white/[0.06]',
                )}
              >
                {c.visit}
                <ArrowUpRight aria-hidden className="size-4" />
                <span className="sr-only">{c.external}</span>
              </a>
            }
          />
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

/** The two actions share one shape and weight; only their tone tells the sides apart. */
const ACTION =
  'inline-flex min-h-12 items-center gap-2.5 rounded-full px-6 text-label font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none';

/** The split field: teal grid (technology) on the left, silver ledger rules (accounting) on the right — mirror images. */
function Backdrop() {
  return (
    <div aria-hidden className="absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,#040a10_12%,#040a10_88%,transparent)]" />
      <div className="absolute inset-y-0 left-0 w-1/2 bg-[radial-gradient(ellipse_70%_55%_at_35%_60%,rgb(25_195_154/0.13),transparent_70%)]" />
      <div className="absolute inset-y-0 left-0 w-1/2 bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_35%_60%,black,transparent_75%)] opacity-30" />
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_70%_55%_at_65%_60%,rgb(214_226_230/0.07),transparent_70%)]" />
      <div className="absolute inset-y-0 right-0 w-1/2 [background-image:repeating-linear-gradient(to_bottom,rgb(214_226_230/0.07)_0_1px,transparent_1px_34px)] [mask-image:radial-gradient(ellipse_70%_60%_at_65%_60%,black,transparent_75%)]" />
    </div>
  );
}

/**
 * One field of expertise. Mirrored on wide screens: each side's content
 * starts at its inner edge, next to CORE, in a zone of the same width.
 */
function Field({
  data,
  side,
  motionProps,
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
  motionProps: object;
  mark: ReactNode;
  name: string;
  secondary: string;
  field: string;
  role: string;
  points: readonly string[];
  action: ReactNode;
}) {
  const left = side === 'left';
  return (
    <motion.article
      {...motionProps}
      data-side={data}
      className={cn(
        'mx-auto flex w-full max-w-xl min-w-0 flex-col items-center text-center lg:mx-0 lg:max-w-none lg:items-start',
        ROWS,
        left
          ? 'lg:col-start-1 lg:row-start-1 lg:justify-items-end lg:text-right'
          : 'lg:col-start-3 lg:row-start-1 lg:justify-items-start lg:text-left',
      )}
    >
      {/* Logo zone: the same height on both sides; logos meet the connector. */}
      <div data-mark-zone className="flex items-center lg:h-36">
        {mark}
      </div>
      <p
        className={cn(
          'mt-7 font-mono text-[0.6875rem] tracking-[0.2em] uppercase',
          left ? 'text-brand-glow' : 'text-[#d6e2e6]',
        )}
      >
        {field}
      </p>
      <h3 className="mt-3 max-w-[26rem] text-[clamp(1.25rem,1rem+0.7vw,1.5rem)] leading-snug font-semibold text-balance text-text-primary lg:self-center">
        <NameWords name={name} />
      </h3>
      <p className="mt-1 max-w-[26rem] text-caption break-words text-text-muted">{secondary}</p>
      <p className="mt-4 text-label font-medium text-text-secondary">{role}</p>
      {/* A left-aligned list on phones (centred block); mirrored toward CORE on wide screens. */}
      <ul className="mt-5 w-fit max-w-[26rem] space-y-2.5 self-center text-left lg:w-auto lg:self-start lg:text-[inherit]">
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
      <div className="mt-8">{action}</div>
    </motion.article>
  );
}

/**
 * Both marks sit on plates of one size (9 rem on wide screens). The CORE mark
 * is small and dark, the S2 artwork large and light — so the PDA BLISS plate
 * carries a teal ring and glow while the S2 plate stays plain silver: equal
 * optical weight without resizing or recolouring either logo.
 */
const PLATE = 'size-28 rounded-[1.75rem] lg:size-36';

function PdaMark() {
  return (
    <span
      data-pda-mark
      className={cn(
        PLATE,
        'grid place-items-center bg-[linear-gradient(145deg,rgb(18_44_52),rgb(6_14_21))] shadow-[inset_0_0_0_1px_rgb(62_240_192/0.4),0_30px_80px_-36px_rgb(62_240_192/0.6)]',
      )}
    >
      <LogoMark className="size-16 lg:size-24" size="large" />
    </span>
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
        className={cn(
          PLATE,
          'grid place-items-center bg-[linear-gradient(145deg,#f4f7f8,#d6e2e6)] text-[1.75rem] font-semibold tracking-tight text-[#0b5e5a]',
        )}
      >
        {INSIGHT_PARTNER.brand}
      </span>
    );
  }
  return (
    <span
      data-partner-logo
      className={cn(
        PLATE,
        'block bg-[linear-gradient(160deg,#f6f9fa,#e3eaec)] p-1 shadow-[0_30px_80px_-40px_rgb(214_226_230/0.5),inset_0_0_0_1px_rgb(255_255_255/0.6)]',
      )}
    >
      <img
        src={logo.src}
        srcSet={`${logo.src} 1x, ${logo.src2x} 2x`}
        alt={alt}
        width={logo.size}
        height={logo.size}
        loading="lazy"
        decoding="async"
        className="block size-full rounded-[1.5rem] object-contain"
      />
    </span>
  );
}

/*
 * Mirror-image line bundles in a 240 × 144 box (the logo row): each set
 * leaves its plate's inner edge at x = 0 / 240 and meets at the centre
 * (120, 72) — the left set is the right set reflected about x = 120.
 */
const LEFT_PATHS = [
  'M0 40 C 40 40, 60 72, 120 72',
  'M0 72 L 120 72',
  'M0 104 C 40 104, 60 72, 120 72',
];
const RIGHT_PATHS = [
  'M240 40 C 200 40, 180 72, 120 72',
  'M240 72 L 120 72',
  'M240 104 C 200 104, 180 72, 120 72',
];

/**
 * The centre: three teal lines from the technology side and three silver
 * lines from the business side converge on one CORE node, on the logos'
 * centre line. CORE is the meeting point, not a third company: no plate, no
 * name — a ring and the word. Phones and tablets show a vertical connector.
 * Lines draw once on entry; with reduced motion they are simply there.
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
      data-core-node
      className="relative grid size-[5.5rem] place-items-center rounded-full bg-[#050b12] font-mono text-[0.75rem] font-semibold tracking-[0.22em] text-brand-glow shadow-[0_0_0_7px_rgb(4_10_16),inset_0_0_0_1px_rgb(62_240_192/0.5),0_0_70px_-14px_rgb(62_240_192/0.45)]"
    >
      <span className="absolute inset-2 rounded-full shadow-[inset_0_0_0_1px_rgb(214_226_230/0.18)]" />
      {/* The ring's own padding keeps the word optically centred (tracking adds space after it). */}
      <span className="pl-[0.22em]">{c.bridge.core}</span>
    </span>
  );
  return (
    <div
      data-bridge
      className="flex flex-col items-center py-10 text-center lg:col-start-2 lg:row-span-7 lg:row-start-1 lg:grid lg:grid-rows-subgrid lg:py-0"
    >
      {/* Wide screens: the node on the logo centre line, lines meeting it from both plates */}
      <div data-connector className="relative hidden h-36 w-full lg:block">
        <svg
          aria-hidden
          viewBox="0 0 240 144"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          fill="none"
        >
          {LEFT_PATHS.map((d, i) => (
            <motion.path
              key={d}
              d={d}
              stroke={TEAL}
              strokeOpacity={i === 1 ? 0.55 : 0.28}
              strokeWidth={i === 1 ? 1.5 : 1}
              vectorEffect="non-scaling-stroke"
              {...draw(0.15 + i * 0.12)}
            />
          ))}
          {RIGHT_PATHS.map((d, i) => (
            <motion.path
              key={d}
              d={d}
              stroke={SILVER}
              strokeOpacity={i === 1 ? 0.55 : 0.28}
              strokeWidth={i === 1 ? 1.5 : 1}
              vectorEffect="non-scaling-stroke"
              {...draw(0.15 + i * 0.12)}
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
      <div className="mt-6 max-w-sm lg:row-span-6 lg:mt-7 lg:max-w-none lg:self-start lg:px-3">
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
