import { motion } from 'framer-motion';
import { ArrowRight, Check, FileText, MessageCircle, StickyNote } from 'lucide-react';
import { Link } from 'react-router';
import { Frame } from '@/components/editorial/Layout';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { usePrefersReducedMotion } from '@/features/landing/home/usePrefersReducedMotion';
import { companyName } from '@/config/company';
import { DeptDot, Lines } from '@/features/story/parts';
import { useCopy } from '@/i18n/useCopy';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/cn';
import { EASE_CORE } from '@/motion/tokens';
import { ABOUT } from './copy';
import { ABOUT_LINKS } from './model';

/* ------------------------------------------------------------------ */
/* Real work → a structured system                                      */
/* ------------------------------------------------------------------ */

type Kind = 'note' | 'chat' | 'doc';

/** Where each fragment rests (sm and up) — scattered, slightly turned. */
const FRAGMENTS: { kind: Kind; left: string; top: string; turn: number }[] = [
  { kind: 'note', left: '2%', top: '6%', turn: -6 },
  { kind: 'chat', left: '44%', top: '0%', turn: 4 },
  { kind: 'doc', left: '12%', top: '38%', turn: 3 },
  { kind: 'chat', left: '52%', top: '34%', turn: -4 },
  { kind: 'note', left: '0%', top: '72%', turn: -2 },
  { kind: 'doc', left: '42%', top: '68%', turn: 5 },
];

const KIND_ICON = { note: StickyNote, chat: MessageCircle, doc: FileText } as const;
const KIND_STYLE: Record<Kind, string> = {
  note: 'bg-[#2a2516]/80 text-[#f3e3b8] shadow-[inset_0_0_0_1px_rgb(245_184_75/0.22)]',
  chat: 'rounded-bl-sm bg-[#10222e]/90 text-text-primary shadow-[inset_0_0_0_1px_rgb(108_184_255/0.2)]',
  doc: 'bg-[#121b23]/90 text-text-secondary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.12)]',
};

/** The department that owns each structured state. */
const STATE_OWNERS = ['sales', 'executive', 'warehouse', 'operations', 'accounting'] as const;

function Fragments() {
  const c = useCopy(ABOUT).hero;
  const reduce = usePrefersReducedMotion();
  return (
    <ul className="flex flex-wrap gap-2.5 sm:relative sm:block sm:h-72">
      {FRAGMENTS.map((f, i) => {
        const Icon = KIND_ICON[f.kind];
        return (
          <motion.li
            key={i}
            data-fragment={f.kind}
            style={{ ['--l' as string]: f.left, ['--t' as string]: f.top, rotate: f.turn }}
            initial={reduce ? false : { opacity: 0, y: 10, rotate: f.turn * 2 }}
            animate={{ opacity: 1, y: 0, rotate: f.turn }}
            transition={{ delay: 0.15 + i * 0.08, duration: 0.7, ease: EASE_CORE }}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-2 text-caption sm:absolute sm:top-(--t) sm:left-(--l) sm:text-label',
              KIND_STYLE[f.kind],
            )}
          >
            <Icon aria-hidden className="size-3.5 shrink-0 opacity-70" />
            {c.fragments[i]}
          </motion.li>
        );
      })}
    </ul>
  );
}

function Structured() {
  const c = useCopy(ABOUT).hero;
  const reduce = usePrefersReducedMotion();
  return (
    <div className="relative">
      <motion.span
        aria-hidden
        className="absolute top-3 bottom-12 left-[0.6875rem] w-px origin-top bg-[linear-gradient(to_bottom,rgb(62_240_192/0.8),rgb(62_240_192/0.25))]"
        initial={reduce ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.6, duration: 1.1, ease: EASE_CORE }}
      />
      <ol className="relative space-y-2.5">
        {c.states.map((s, i) => {
          const done = i < 2;
          const current = i === 2;
          return (
            <motion.li
              key={s}
              data-state={STATE_OWNERS[i]!}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.12, duration: 0.55, ease: EASE_CORE }}
              className="flex items-center gap-3"
            >
              <span
                aria-hidden
                className={cn(
                  'relative flex size-[1.375rem] shrink-0 items-center justify-center rounded-full bg-surface-dark',
                  current
                    ? 'shadow-[inset_0_0_0_2px_rgb(62_240_192),0_0_18px_rgb(62_240_192/0.55)]'
                    : 'shadow-[inset_0_0_0_1.5px_rgb(62_240_192/0.5)]',
                )}
              >
                {done ? (
                  <Check className="size-3 text-brand-glow" />
                ) : (
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      current ? 'bg-brand-glow' : 'bg-white/25',
                    )}
                  />
                )}
              </span>
              <span
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3.5 py-2 text-label',
                  current
                    ? 'bg-brand-primary/12 text-text-primary shadow-[inset_0_0_0_1px_rgb(62_240_192/0.3)]'
                    : 'bg-white/[0.035] text-text-secondary',
                )}
              >
                <DeptDot id={STATE_OWNERS[i]!} />
                {s}
              </span>
            </motion.li>
          );
        })}
      </ol>
      <p className="mt-5 flex items-center gap-2 pl-0.5 text-caption font-semibold tracking-[0.28em] text-brand-glow">
        <span aria-hidden className="size-[1.375rem] rounded-full bg-brand-glow/15 p-1">
          <span className="block size-full rounded-full bg-brand-glow" />
        </span>
        CORE
      </p>
    </div>
  );
}

/** Convergence: scattered threads gathering into one line (decorative). */
function Converge() {
  return (
    <svg viewBox="0 0 120 300" preserveAspectRatio="none" className="h-72 w-full" aria-hidden>
      <defs>
        <linearGradient id="about-converge" x1="0" x2="1">
          <stop offset="0%" stopColor="#a3b8b2" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3ef0c0" stopOpacity="0.75" />
        </linearGradient>
      </defs>
      {[20, 70, 120, 170, 220, 270].map((y, i) => (
        <path
          key={y}
          d={`M 0 ${y} C 50 ${y}, 60 150, 120 150`}
          fill="none"
          stroke="url(#about-converge)"
          strokeWidth="1.2"
          strokeDasharray={i % 2 ? '2 5' : undefined}
        />
      ))}
    </svg>
  );
}

function RealWorkToSystem() {
  const c = useCopy(ABOUT).hero;
  return (
    <figure aria-label={c.visual} data-hero-visual className="relative">
      <div className="grid grid-cols-1 items-center gap-8 sm:grid-cols-[minmax(0,1.15fr)_4.5rem_minmax(0,0.9fr)] sm:gap-4 lg:grid-cols-[minmax(0,1.2fr)_7rem_minmax(0,0.85fr)] lg:gap-8">
        <div>
          <p className="mb-4 text-caption font-semibold text-warning/80 uppercase">
            {c.fragmentsLabel}
          </p>
          <Fragments />
        </div>
        <div className="hidden sm:block">
          <Converge />
        </div>
        <div>
          <p className="mb-4 text-caption font-semibold text-brand-soft uppercase">
            {c.structuredLabel}
          </p>
          <Structured />
        </div>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                 */
/* ------------------------------------------------------------------ */

export function AboutHero() {
  const c = useCopy(ABOUT).hero;
  const { href, locale } = useLocale();
  return (
    <section aria-labelledby="about-title" className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_55%_50%_at_80%_20%,rgb(62_224_180/0.09),transparent_70%),radial-gradient(ellipse_45%_45%_at_5%_85%,rgb(245_184_75/0.05),transparent_70%)]"
      />
      <Frame width="wide" className="pt-28 pb-20 sm:pt-32 lg:pt-40 lg:pb-28">
        <p className="flex items-center gap-3 text-caption font-semibold text-brand-soft">
          <span aria-hidden className="h-px w-6 bg-current opacity-70" />
          <span lang={locale === 'th' ? 'th' : undefined}>{companyName(locale)}</span>
        </p>
        <h1
          id="about-title"
          className="mt-6 max-w-5xl text-[clamp(1.875rem,1.05rem+3.2vw,4.25rem)] leading-[1.18] font-semibold tracking-tight"
        >
          <span className="block text-text-muted">
            <Lines text={c.titleA} />
          </span>
          <span className="mt-4 block text-text-primary sm:mt-6">
            <Lines text={c.titleB} />
          </span>
        </h1>
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <p className="max-w-2xl border-l-2 border-brand-primary/50 pl-5 text-body-lg text-text-secondary">
            {c.lead}
          </p>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Link
              to={href(ABOUT_LINKS.contact)}
              data-cta="talk"
              className={buttonClasses('primary', 'lg')}
            >
              {c.talk}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              to={href(ABOUT_LINKS.whyCore)}
              data-cta="why"
              className={buttonClasses('secondary', 'lg')}
            >
              {c.why}
            </Link>
          </div>
        </div>
        <div className="mt-16 lg:mt-24">
          <RealWorkToSystem />
        </div>
      </Frame>
    </section>
  );
}
